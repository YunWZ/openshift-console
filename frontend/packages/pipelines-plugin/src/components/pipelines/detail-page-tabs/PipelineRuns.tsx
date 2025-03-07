import * as React from 'react';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { RowFilter } from '@console/internal/components/filter-toolbar';
import { referenceForModel } from '@console/internal/module/k8s';
import { PipelineRunModel } from '../../../models';
import {
  pipelineRunFilterReducer,
  pipelineRunStatusFilter,
} from '../../../utils/pipeline-filter-reducer';
import { ListFilterId, ListFilterLabels } from '../../../utils/pipeline-utils';
import { ListPage } from '../../ListPage';
import { useGetPipelineRuns } from '../../pipelineruns/hooks/useTektonResults';
import PipelineRunsList from '../../pipelineruns/list-page/PipelineRunList';
import { PipelineDetailsTabProps } from './types';

export const runFilters = (t: TFunction): RowFilter[] => {
  return [
    {
      filterGroupName: t('pipelines-plugin~Status'),
      type: 'pipelinerun-status',
      reducer: pipelineRunFilterReducer,
      items: [
        { id: ListFilterId.Succeeded, title: ListFilterLabels[ListFilterId.Succeeded] },
        { id: ListFilterId.Running, title: ListFilterLabels[ListFilterId.Running] },
        { id: ListFilterId.Failed, title: ListFilterLabels[ListFilterId.Failed] },
        { id: ListFilterId.Cancelled, title: ListFilterLabels[ListFilterId.Cancelled] },
      ],
      filter: pipelineRunStatusFilter,
    },
  ];
};

const PipelineRuns: React.FC<PipelineDetailsTabProps> = ({ obj }) => {
  const { t } = useTranslation();
  const [pipelineRuns, pipelineRunsLoaded, pipelineRunsLoadError] = useGetPipelineRuns(
    obj.metadata.namespace,
    { name: obj.metadata.name, kind: obj.kind },
  );

  const resources = React.useMemo(
    () => ({
      [referenceForModel(PipelineRunModel)]: {
        data: pipelineRuns,
        kind: referenceForModel(PipelineRunModel),
        loadError: pipelineRunsLoadError,
        loaded: pipelineRunsLoaded,
      },
    }),
    [pipelineRunsLoadError, pipelineRunsLoaded, pipelineRuns],
  );
  return (
    <ListPage
      showTitle={false}
      canCreate={false}
      kind={referenceForModel(PipelineRunModel)}
      namespace={obj.metadata.namespace}
      selector={{
        matchLabels: { 'tekton.dev/pipeline': obj.metadata.name },
      }}
      ListComponent={PipelineRunsList}
      rowFilters={runFilters(t)}
      data={resources}
    />
  );
};

export default PipelineRuns;
