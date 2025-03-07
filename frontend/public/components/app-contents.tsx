import * as _ from 'lodash-es';
import * as React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';

import {
  useActivePerspective,
  Perspective,
  RoutePage as DynamicRoutePage,
  isRoutePage as isDynamicRoutePage,
} from '@console/dynamic-plugin-sdk';
import { useDynamicPluginInfo } from '@console/plugin-sdk/src/api/useDynamicPluginInfo';
import { FLAGS, useUserSettings, getPerspectiveVisitedKey, usePerspectives } from '@console/shared';
import { ErrorBoundaryPage } from '@console/shared/src/components/error';
import { connectToFlags } from '../reducers/connectToFlags';
import { flagPending, FlagsObject } from '../reducers/features';
import { GlobalNotifications } from './global-notifications';
import { NamespaceBar } from './namespace-bar';
import { SearchPage } from './search';
import { ResourceDetailsPage, ResourceListPage } from './resource-list';
import { AsyncComponent, LoadingBox } from './utils';
import { namespacedPrefixes } from './utils/link';
import {
  AlertmanagerModel,
  CronJobModel,
  HorizontalPodAutoscalerModel,
  VolumeSnapshotModel,
} from '../models';
import { referenceForModel } from '../module/k8s';
import { NamespaceRedirect } from './utils/namespace-redirect';

//PF4 Imports
import { PageSection, PageSectionVariants } from '@patternfly/react-core';
import { RoutePage, isRoutePage, useExtensions, LoadedExtension } from '@console/plugin-sdk';

import CreateResource from './create-resource';

const RedirectComponent = (props) => {
  const to = `/k8s${props.location.pathname}`;
  return <Redirect to={to} />;
};

// Ensure a *const* function wrapper for each namespaced Component so that react router doesn't recreate them
const Memoized = new Map();
function NamespaceFromURL(Component) {
  let C = Memoized.get(Component);
  if (!C) {
    C = function NamespaceInjector(props) {
      return <Component namespace={props.match.params.ns} {...props} />;
    };
    Memoized.set(Component, C);
  }
  return C;
}

const namespacedRoutes = [];
_.each(namespacedPrefixes, (p) => {
  namespacedRoutes.push(`${p}/ns/:ns`);
  namespacedRoutes.push(`${p}/all-namespaces`);
});

const DefaultPageRedirect: React.FC<{
  url: Perspective['properties']['landingPageURL'];
  flags: { [key: string]: boolean };
  firstVisit: boolean;
}> = ({ url, flags, firstVisit }) => {
  const [resolvedUrl, setResolvedUrl] = React.useState<string>();
  React.useEffect(() => {
    (async () => {
      setResolvedUrl((await url())(flags, firstVisit));
    })();
  }, [url, flags, firstVisit]);

  return resolvedUrl ? <Redirect to={resolvedUrl} /> : null;
};

type DefaultPageProps = {
  flags: FlagsObject;
};

// The default page component lets us connect to flags without connecting the entire App.
const DefaultPage_: React.FC<DefaultPageProps> = ({ flags }) => {
  const [activePerspective] = useActivePerspective();
  const perspectiveExtensions = usePerspectives();
  const [visited, setVisited, visitedLoaded] = useUserSettings<boolean>(
    getPerspectiveVisitedKey(activePerspective),
    false,
  );
  const firstVisit = React.useRef<boolean>();

  // First time thru, capture first visit status
  if (firstVisit.current == null && visitedLoaded) {
    firstVisit.current = !visited;
  }

  React.useEffect(() => {
    if (visitedLoaded && !visited) {
      // Mark perspective as visited
      setVisited(true);
    }
  }, [visitedLoaded, visited, setVisited]);

  if (Object.keys(flags).some((key) => flagPending(flags[key])) || !visitedLoaded) {
    return <LoadingBox />;
  }

  const perspective = perspectiveExtensions.find((p) => p?.properties?.id === activePerspective);

  // support redirecting to perspective landing page
  return (
    <DefaultPageRedirect
      flags={flags}
      firstVisit={firstVisit.current}
      url={perspective?.properties?.landingPageURL}
    />
  );
};

const DefaultPage = connectToFlags(
  FLAGS.OPENSHIFT,
  FLAGS.CAN_LIST_NS,
  FLAGS.MONITORING,
)(DefaultPage_);

const LazyRoute = (props) => (
  <Route
    {...props}
    component={undefined}
    render={(componentProps) => (
      <AsyncComponent loader={props.loader} kind={props.kind} {...componentProps} />
    )}
  />
);

const LazyDynamicRoute: React.FC<
  Omit<React.ComponentProps<typeof Route>, 'component'> & {
    component: LoadedExtension<DynamicRoutePage>['properties']['component'];
  }
> = ({ component, ...props }) => {
  const LazyComponent = React.useMemo(
    () =>
      React.lazy(async () => {
        const Component = await component();
        // TODO do not wrap as `default` when we support module code refs
        return { default: Component };
      }),
    [component],
  );
  return <Route {...props} component={LazyComponent} />;
};

const getPluginPageRoutes = (
  activePerspective: string,
  setActivePerspective: (perspective: string) => void,
  routePages: RoutePage[],
  dynamicRoutePages: LoadedExtension<DynamicRoutePage>[],
) => {
  const activeRoutes = [
    ...routePages
      .filter((r) => !r.properties.perspective || r.properties.perspective === activePerspective)
      .map((r) => {
        const Component = r.properties.loader ? LazyRoute : Route;
        return <Component {...r.properties} key={Array.from(r.properties.path).join(',')} />;
      }),
    ...dynamicRoutePages
      .filter((r) => !r.properties.perspective || r.properties.perspective === activePerspective)
      .map((r) => (
        <LazyDynamicRoute
          exact={r.properties.exact}
          path={r.properties.path}
          component={r.properties.component}
          key={r.uid}
        />
      )),
  ];

  const inactiveRoutes = [...routePages, ...dynamicRoutePages]
    .filter((r) => r.properties.perspective && r.properties.perspective !== activePerspective)
    .map((r) => {
      const key = Array.from(r.properties.path).concat([r.properties.perspective]).join(',');

      return (
        <Route
          {...r.properties}
          key={key}
          component={() => {
            React.useEffect(() => setActivePerspective(r.properties.perspective));
            return null;
          }}
        />
      );
    });

  return [activeRoutes, inactiveRoutes];
};

const AppContents: React.FC<{}> = () => {
  const [activePerspective, setActivePerspective] = useActivePerspective();
  const routePageExtensions = useExtensions<RoutePage>(isRoutePage);
  const dynamicRoutePages = useExtensions<DynamicRoutePage>(isDynamicRoutePage);
  const [, allPluginsProcessed] = useDynamicPluginInfo();

  const [pluginPageRoutes, inactivePluginPageRoutes] = React.useMemo(
    () =>
      getPluginPageRoutes(
        activePerspective,
        setActivePerspective,
        routePageExtensions,
        dynamicRoutePages,
      ),
    [activePerspective, setActivePerspective, routePageExtensions, dynamicRoutePages],
  );

  const contentRouter = (
    <Switch>
      {pluginPageRoutes}

      <Route path={['/all-namespaces', '/ns/:ns']} component={RedirectComponent} />
      <LazyRoute
        path="/dashboards"
        loader={() =>
          import(
            './dashboard/dashboards-page/dashboards' /* webpackChunkName: "dashboards" */
          ).then((m) => m.DashboardsPage)
        }
      />

      {/* Redirect legacy routes to avoid breaking links */}
      <Redirect from="/cluster-status" to="/dashboards" />
      <Redirect from="/status/all-namespaces" to="/dashboards" />
      <Redirect from="/status/ns/:ns" to="/k8s/cluster/projects/:ns" />
      <Route path="/status" exact component={NamespaceRedirect} />
      <Redirect from="/overview/all-namespaces" to="/dashboards" />
      <Redirect from="/overview/ns/:ns" to="/k8s/cluster/projects/:ns/workloads" />
      <Route path="/overview" exact component={NamespaceRedirect} />

      <LazyRoute
        path="/api-explorer"
        exact
        loader={() =>
          import('./api-explorer' /* webpackChunkName: "api-explorer" */).then(
            (m) => m.APIExplorerPage,
          )
        }
      />
      <LazyRoute
        path="/api-resource/cluster/:plural"
        loader={() =>
          import('./api-explorer' /* webpackChunkName: "api-explorer" */).then(
            (m) => m.APIResourcePage,
          )
        }
      />
      <LazyRoute
        path="/api-resource/all-namespaces/:plural"
        loader={() =>
          import('./api-explorer' /* webpackChunkName: "api-explorer" */).then((m) =>
            NamespaceFromURL(m.APIResourcePage),
          )
        }
      />
      <LazyRoute
        path="/api-resource/ns/:ns/:plural"
        loader={() =>
          import('./api-explorer' /* webpackChunkName: "api-explorer" */).then((m) =>
            NamespaceFromURL(m.APIResourcePage),
          )
        }
      />

      <LazyRoute
        path="/command-line-tools"
        exact
        loader={() =>
          import('./command-line-tools' /* webpackChunkName: "command-line-tools" */).then(
            (m) => m.CommandLineToolsPage,
          )
        }
      />

      <Route path="/operatorhub" exact component={NamespaceRedirect} />

      <LazyRoute
        path="/catalog/instantiate-template"
        exact
        loader={() =>
          import('./instantiate-template' /* webpackChunkName: "instantiate-template" */).then(
            (m) => m.InstantiateTemplatePage,
          )
        }
      />

      <Route
        path="/k8s/ns/:ns/alertmanagers/:name"
        exact
        render={({ match }) => (
          <Redirect
            to={`/k8s/ns/${match.params.ns}/${referenceForModel(AlertmanagerModel)}/${
              match.params.name
            }`}
          />
        )}
      />

      <Redirect
        exact
        from="/k8s/ns/:ns/batch~v1beta1~CronJob/:name"
        to={`/k8s/ns/:ns/${CronJobModel.plural}/:name`}
      />

      <Redirect
        exact
        from="/k8s/ns/:ns/autoscaling~v2beta2~HorizontalPodAutoscaler/:name"
        to={`/k8s/ns/:ns/${HorizontalPodAutoscalerModel.plural}/:name`}
      />

      <LazyRoute
        path="/k8s/all-namespaces/events"
        exact
        loader={() =>
          import('./events' /* webpackChunkName: "events" */).then((m) =>
            NamespaceFromURL(m.EventStreamPage),
          )
        }
      />
      <LazyRoute
        path="/k8s/ns/:ns/events"
        exact
        loader={() =>
          import('./events' /* webpackChunkName: "events" */).then((m) =>
            NamespaceFromURL(m.EventStreamPage),
          )
        }
      />
      <Route path="/search/all-namespaces" exact component={NamespaceFromURL(SearchPage)} />
      <Route path="/search/ns/:ns" exact component={NamespaceFromURL(SearchPage)} />
      <Route path="/search" exact component={NamespaceRedirect} />

      <LazyRoute
        path="/k8s/all-namespaces/import"
        exact
        loader={() =>
          import('./import-yaml' /* webpackChunkName: "import-yaml" */).then((m) =>
            NamespaceFromURL(m.ImportYamlPage),
          )
        }
      />
      <LazyRoute
        path="/k8s/ns/:ns/import/"
        exact
        loader={() =>
          import('./import-yaml' /* webpackChunkName: "import-yaml" */).then((m) =>
            NamespaceFromURL(m.ImportYamlPage),
          )
        }
      />
      <LazyRoute
        path="/k8s/ns/:ns/secrets/~new/:type"
        exact
        kind="Secret"
        loader={() =>
          import('./secrets/create-secret' /* webpackChunkName: "create-secret" */).then(
            (m) => m.CreateSecret,
          )
        }
      />
      <LazyRoute
        path="/k8s/ns/:ns/configmaps/~new/form"
        exact
        kind="ConfigMap"
        loader={() =>
          import('./configmaps/ConfigMapPage' /* webpackChunkName: "create-configmap-page" */).then(
            (m) => m.default,
          )
        }
      />
      <LazyRoute
        path="/k8s/ns/:ns/configmaps/:name/form"
        exact
        kind="ConfigMap"
        loader={() =>
          import('./configmaps/ConfigMapPage' /* webpackChunkName: "edit-configmap-page" */).then(
            (m) => m.default,
          )
        }
      />
      <LazyRoute
        path="/k8s/ns/:ns/secrets/:name/edit"
        exact
        kind="Secret"
        loader={() =>
          import('./secrets/create-secret' /* webpackChunkName: "create-secret" */).then(
            (m) => m.EditSecret,
          )
        }
      />
      <LazyRoute
        path="/k8s/ns/:ns/secrets/:name/edit-yaml"
        exact
        kind="Secret"
        loader={() => import('./create-yaml').then((m) => m.EditYAMLPage)}
      />

      <LazyRoute
        path="/k8s/ns/:ns/networkpolicies/~new/form"
        exact
        kind="NetworkPolicy"
        loader={() =>
          import(
            '@console/app/src/components/network-policies/create-network-policy' /* webpackChunkName: "create-network-policy" */
          ).then((m) => m.CreateNetworkPolicy)
        }
      />

      <LazyRoute
        path="/k8s/ns/:ns/routes/~new/form"
        exact
        kind="Route"
        loader={() =>
          import('./routes/RoutePage' /* webpackChunkName: "create-route" */).then(
            (m) => m.RoutePage,
          )
        }
      />

      <LazyRoute
        path="/k8s/ns/:ns/routes/:name/form"
        exact
        kind="Route"
        loader={() =>
          import('./routes/RoutePage' /* webpackChunkName: "edit-route" */).then((m) => m.RoutePage)
        }
      />

      <LazyRoute
        path="/k8s/cluster/rolebindings/~new"
        exact
        loader={() =>
          import('./RBAC' /* webpackChunkName: "rbac" */).then((m) => m.CreateRoleBinding)
        }
        kind="RoleBinding"
      />
      <LazyRoute
        path="/k8s/ns/:ns/rolebindings/~new"
        exact
        loader={() =>
          import('./RBAC' /* webpackChunkName: "rbac" */).then((m) => m.CreateRoleBinding)
        }
        kind="RoleBinding"
      />
      <LazyRoute
        path="/k8s/ns/:ns/rolebindings/:name/copy"
        exact
        kind="RoleBinding"
        loader={() =>
          import('./RBAC' /* webpackChunkName: "rbac" */).then((m) => m.CopyRoleBinding)
        }
      />
      <LazyRoute
        path="/k8s/ns/:ns/rolebindings/:name/edit"
        exact
        kind="RoleBinding"
        loader={() =>
          import('./RBAC' /* webpackChunkName: "rbac" */).then((m) => m.EditRoleBinding)
        }
      />
      <LazyRoute
        path="/k8s/cluster/clusterrolebindings/:name/copy"
        exact
        kind="ClusterRoleBinding"
        loader={() =>
          import('./RBAC' /* webpackChunkName: "rbac" */).then((m) => m.CopyRoleBinding)
        }
      />
      <LazyRoute
        path="/k8s/cluster/clusterrolebindings/:name/edit"
        exact
        kind="ClusterRoleBinding"
        loader={() =>
          import('./RBAC' /* webpackChunkName: "rbac" */).then((m) => m.EditRoleBinding)
        }
      />
      <LazyRoute
        path="/k8s/ns/:ns/:plural/:name/attach-storage"
        exact
        loader={() =>
          import('./storage/attach-storage' /* webpackChunkName: "attach-storage" */).then(
            (m) => m.default,
          )
        }
      />

      <LazyRoute
        path="/k8s/ns/:ns/persistentvolumeclaims/~new/form"
        exact
        kind="PersistentVolumeClaim"
        loader={() =>
          import('./storage/create-pvc' /* webpackChunkName: "create-pvc" */).then(
            (m) => m.CreatePVC,
          )
        }
      />

      <LazyRoute
        path={`/k8s/ns/:ns/${VolumeSnapshotModel.plural}/~new/form`}
        exact
        loader={() =>
          import(
            '@console/app/src/components/volume-snapshot/create-volume-snapshot/create-volume-snapshot' /* webpackChunkName: "create-volume-snapshot" */
          ).then((m) => m.VolumeSnapshot)
        }
      />

      <LazyRoute
        path={`/k8s/all-namespaces/${VolumeSnapshotModel.plural}/~new/form`}
        exact
        loader={() =>
          import(
            '@console/app/src/components/volume-snapshot/create-volume-snapshot/create-volume-snapshot' /* webpackChunkName: "create-volume-snapshot" */
          ).then((m) => m.VolumeSnapshot)
        }
      />

      <LazyRoute
        path="/monitoring/alertmanageryaml"
        exact
        loader={() =>
          import('./monitoring/alerting' /* webpackChunkName: "alerting" */).then(
            (m) => m.MonitoringUI,
          )
        }
      />
      <LazyRoute
        path="/monitoring/alertmanagerconfig"
        exact
        loader={() =>
          import('./monitoring/alerting' /* webpackChunkName: "alerting" */).then(
            (m) => m.MonitoringUI,
          )
        }
      />
      <LazyRoute
        path="/monitoring/alertmanagerconfig/receivers/~new"
        exact
        loader={() =>
          import(
            './monitoring/receiver-forms/alert-manager-receiver-forms' /* webpackChunkName: "receiver-forms" */
          ).then((m) => m.CreateReceiver)
        }
      />
      <LazyRoute
        path="/monitoring/alertmanagerconfig/receivers/:name/edit"
        exact
        loader={() =>
          import(
            './monitoring/receiver-forms/alert-manager-receiver-forms' /* webpackChunkName: "receiver-forms" */
          ).then((m) => m.EditReceiver)
        }
      />

      <LazyRoute
        path="/settings/idp/github"
        exact
        loader={() =>
          import(
            './cluster-settings/github-idp-form' /* webpackChunkName: "github-idp-form" */
          ).then((m) => m.AddGitHubPage)
        }
      />
      <LazyRoute
        path="/settings/idp/gitlab"
        exact
        loader={() =>
          import(
            './cluster-settings/gitlab-idp-form' /* webpackChunkName: "gitlab-idp-form" */
          ).then((m) => m.AddGitLabPage)
        }
      />
      <LazyRoute
        path="/settings/idp/google"
        exact
        loader={() =>
          import(
            './cluster-settings/google-idp-form' /* webpackChunkName: "google-idp-form" */
          ).then((m) => m.AddGooglePage)
        }
      />
      <LazyRoute
        path="/settings/idp/htpasswd"
        exact
        loader={() =>
          import(
            './cluster-settings/htpasswd-idp-form' /* webpackChunkName: "htpasswd-idp-form" */
          ).then((m) => m.AddHTPasswdPage)
        }
      />
      <LazyRoute
        path="/settings/idp/keystone"
        exact
        loader={() =>
          import(
            './cluster-settings/keystone-idp-form' /* webpackChunkName: "keystone-idp-form" */
          ).then((m) => m.AddKeystonePage)
        }
      />
      <LazyRoute
        path="/settings/idp/ldap"
        exact
        loader={() =>
          import('./cluster-settings/ldap-idp-form' /* webpackChunkName: "ldap-idp-form" */).then(
            (m) => m.AddLDAPPage,
          )
        }
      />
      <LazyRoute
        path="/settings/idp/oidconnect"
        exact
        loader={() =>
          import(
            './cluster-settings/openid-idp-form' /* webpackChunkName: "openid-idp-form" */
          ).then((m) => m.AddOpenIDIDPPage)
        }
      />
      <LazyRoute
        path="/settings/idp/basicauth"
        exact
        loader={() =>
          import(
            './cluster-settings/basicauth-idp-form' /* webpackChunkName: "basicauth-idp-form" */
          ).then((m) => m.AddBasicAuthPage)
        }
      />
      <LazyRoute
        path="/settings/idp/requestheader"
        exact
        loader={() =>
          import(
            './cluster-settings/request-header-idp-form' /* webpackChunkName: "request-header-idp-form" */
          ).then((m) => m.AddRequestHeaderPage)
        }
      />
      <LazyRoute
        path="/settings/cluster"
        loader={() =>
          import(
            './cluster-settings/cluster-settings' /* webpackChunkName: "cluster-settings" */
          ).then((m) => m.ClusterSettingsPage)
        }
      />

      <LazyRoute
        path={'/k8s/cluster/storageclasses/~new/form'}
        exact
        loader={() =>
          import('./storage-class-form' /* webpackChunkName: "storage-class-form" */).then(
            (m) => m.StorageClassForm,
          )
        }
      />
      <LazyRoute
        path="/k8s/ns/:ns/:resourceRef/form"
        exact
        kind="PodDisruptionBudgets"
        loader={() =>
          import(
            '@console/app/src/components/pdb/PDBFormPage' /* webpackChunkName: "PDBFormPage" */
          ).then((m) => m.PDBFormPage)
        }
      />
      <Route path="/k8s/cluster/:plural" exact component={ResourceListPage} />
      <Route path="/k8s/cluster/:plural/~new" exact component={CreateResource} />
      <Route path="/k8s/cluster/:plural/:name" component={ResourceDetailsPage} />
      <LazyRoute
        path="/k8s/ns/:ns/pods/:podName/containers/:name/debug"
        loader={() =>
          import('./debug-terminal' /* webpackChunkName: "debug-terminal" */).then(
            (m) => m.DebugTerminalPage,
          )
        }
      />
      <LazyRoute
        path="/k8s/ns/:ns/pods/:podName/containers/:name"
        loader={() => import('./container').then((m) => m.ContainersDetailsPage)}
      />
      <Route path="/k8s/ns/:ns/:plural/~new" component={CreateResource} />
      <Route path="/k8s/ns/:ns/:plural/:name" component={ResourceDetailsPage} />
      <Route path="/k8s/ns/:ns/:plural" exact component={ResourceListPage} />

      <Route path="/k8s/all-namespaces/:plural" exact component={ResourceListPage} />
      <Route path="/k8s/all-namespaces/:plural/:name" component={ResourceDetailsPage} />

      {inactivePluginPageRoutes}
      <Route path="/" exact component={DefaultPage} />

      {allPluginsProcessed ? (
        <LazyRoute
          loader={() =>
            import('./error' /* webpackChunkName: "error" */).then((m) => m.ErrorPage404)
          }
        />
      ) : (
        <Route component={LoadingBox} />
      )}
    </Switch>
  );

  return (
    <div id="content">
      <PageSection variant={PageSectionVariants.light} padding={{ default: 'noPadding' }}>
        <GlobalNotifications />
        <Route path={namespacedRoutes} component={NamespaceBar} />
      </PageSection>
      <div id="content-scrollable">
        <PageSection
          className="pf-v5-page__main-section--flex co-page-backdrop"
          padding={{ default: 'noPadding' }}
        >
          <ErrorBoundaryPage>
            <React.Suspense fallback={<LoadingBox />}>{contentRouter}</React.Suspense>
          </ErrorBoundaryPage>
        </PageSection>
      </div>
    </div>
  );
};

export default AppContents;
