import * as React from 'react';
import { Card, CardHeader, CardTitle } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  DashboardItemProps,
  withDashboardResources,
} from '@console/internal/components/dashboard/with-dashboard-resources';
import { FirehoseResource, FirehoseResult, resourcePath } from '@console/internal/components/utils';
import { EventModel } from '@console/internal/models';
import { EventKind } from '@console/internal/module/k8s';
import ActivityBody, {
  PauseButton,
  RecentEventsBodyContent,
} from '@console/shared/src/components/dashboard/activity-card/ActivityBody';
import { VirtualMachineInstanceModel, VirtualMachineModel } from '../../../models';
import { kubevirtReferenceForModel } from '../../../models/kubevirtReferenceForModel';
import { getName, getNamespace } from '../../../selectors';
import { getVmEventsFilters } from '../../../selectors/event';
import { VMILikeEntityKind } from '../../../types/vmLike';
import { VMDashboardContext } from '../../vms/vm-dashboard-context';

import './vm-activity.scss';

const combinedVmFilter = (vm: VMILikeEntityKind): EventFilterFuncion => (event) =>
  getVmEventsFilters(vm).some((filter) => filter(event.involvedObject, event));

const getEventsResource = (namespace: string): FirehoseResource => ({
  isList: true,
  kind: EventModel.kind,
  prop: 'events',
  namespace,
});

const RecentEvent = withDashboardResources<RecentEventProps>(
  ({ watchK8sResource, stopWatchK8sResource, resources, vm, paused, setPaused }) => {
    React.useEffect(() => {
      if (vm) {
        const eventsResource = getEventsResource(getNamespace(vm));
        watchK8sResource(eventsResource);
        return () => {
          stopWatchK8sResource(eventsResource);
        };
      }
      return null;
    }, [watchK8sResource, stopWatchK8sResource, vm]);
    return (
      <RecentEventsBodyContent
        events={resources.events as FirehoseResult<EventKind[]>}
        filter={combinedVmFilter(vm)}
        paused={paused}
        setPaused={setPaused}
      />
    );
  },
);

export const VMActivityCard: React.FC = () => {
  const { t } = useTranslation();
  const { vm, vmi } = React.useContext(VMDashboardContext);
  const vmiLike = vm || vmi;

  const [paused, setPaused] = React.useState(false);
  const togglePause = React.useCallback(() => setPaused(!paused), [paused]);

  const name = getName(vmiLike);
  const namespace = getNamespace(vmiLike);
  const viewEventsLink = `${resourcePath(
    vm
      ? kubevirtReferenceForModel(VirtualMachineModel)
      : kubevirtReferenceForModel(VirtualMachineInstanceModel),
    name,
    namespace,
  )}/events`;

  return (
    <Card className="co-overview-card--gradient" isClickable isSelectable>
      <CardHeader
        actions={{
          actions: (
            <>
              <Link to={viewEventsLink}>{t('kubevirt-plugin~View all')}</Link>
              <PauseButton paused={paused} togglePause={togglePause} />
            </>
          ),
          hasNoOffset: false,
          className: 'kubevirt-activity-card__actions co-overview-card__actions',
        }}
      >
        <CardTitle>{t('kubevirt-plugin~Events')}</CardTitle>
      </CardHeader>
      <ActivityBody>
        <RecentEvent vm={vmiLike} paused={paused} setPaused={setPaused} />
      </ActivityBody>
    </Card>
  );
};

type EventFilterFuncion = (event: EventKind) => boolean;

type RecentEventProps = DashboardItemProps & {
  vm: VMILikeEntityKind;
  paused: boolean;
  setPaused: (paused: boolean) => void;
};
