import * as React from 'react';
import { BanIcon } from '@patternfly/react-icons/dist/esm/icons/ban-icon';
import { ClipboardListIcon } from '@patternfly/react-icons/dist/esm/icons/clipboard-list-icon';
import { HourglassHalfIcon } from '@patternfly/react-icons/dist/esm/icons/hourglass-half-icon';
import { HourglassStartIcon } from '@patternfly/react-icons/dist/esm/icons/hourglass-start-icon';
import { NotStartedIcon } from '@patternfly/react-icons/dist/esm/icons/not-started-icon';
import { SyncAltIcon } from '@patternfly/react-icons/dist/esm/icons/sync-alt-icon';
import { UnknownIcon } from '@patternfly/react-icons/dist/esm/icons/unknown-icon';
import { StatusComponentProps } from '../../../extensions/console-types';
import { DASH } from '../../constants';
import { YellowExclamationTriangleIcon } from './icons';
import { ErrorStatus, InfoStatus, ProgressStatus, SuccessStatus } from './statuses';
import StatusIconAndText from './StatusIconAndText';

export type StatusProps = StatusComponentProps & {
  status: string;
  children?: React.ReactNode;
};

/**
 * Component for displaying a status message
 * @param {string} status - type of status to be displayed
 * @param {string} [title] - (optional) status text
 * @param {boolean} [iconOnly] - (optional) if true, only displays icon
 * @param {boolean} [noTooltip] - (optional) if true, tooltip won't be displayed
 * @param {string} [className] - (optional) additional class name for the component
 * @param {string} [popoverTitle] - (optional) title for popover
 * @param {ReactNode} [children] - (optional) children for the component
 * @example
 * ```tsx
 * <Status status='Warning' />
 * ```
 */
const Status: React.FC<StatusProps> = ({
  status,
  title,
  children,
  iconOnly,
  noTooltip,
  className,
}) => {
  const statusProps = { title: title || status, iconOnly, noTooltip, className };
  switch (status) {
    case 'New':
      return <StatusIconAndText {...statusProps} icon={<HourglassStartIcon />} />;

    case 'Pending':
      return <StatusIconAndText {...statusProps} icon={<HourglassHalfIcon />} />;

    case 'Planning':
      return <StatusIconAndText {...statusProps} icon={<ClipboardListIcon />} />;

    case 'ContainerCreating':
    case 'UpgradePending':
    case 'PendingUpgrade':
    case 'PendingRollback':
      return <ProgressStatus {...statusProps} />;

    case 'In Progress':
    case 'Installing':
    case 'InstallReady':
    case 'Replacing':
    case 'Running':
    case 'Updating':
    case 'Upgrading':
    case 'PendingInstall':
      return <StatusIconAndText {...statusProps} icon={<SyncAltIcon />} />;

    case 'Cancelled':
    case 'Deleting':
    case 'Expired':
    case 'Not Ready':
    case 'Cancelling':
    case 'Terminating':
    case 'Superseded':
    case 'Uninstalling':
      return <StatusIconAndText {...statusProps} icon={<BanIcon />} />;

    case 'Warning':
    case 'RequiresApproval':
      return <StatusIconAndText {...statusProps} icon={<YellowExclamationTriangleIcon />} />;

    case 'ContainerCannotRun':
    case 'CrashLoopBackOff':
    case 'Critical':
    case 'ErrImagePull':
    case 'Error':
    case 'Failed':
    case 'Failure':
    case 'ImagePullBackOff':
    case 'InstallCheckFailed':
    case 'Lost':
    case 'Rejected':
    case 'UpgradeFailed':
      return <ErrorStatus {...statusProps}>{children}</ErrorStatus>;

    case 'Accepted':
    case 'Active':
    case 'Bound':
    case 'Complete':
    case 'Completed':
    case 'Created':
    case 'Enabled':
    case 'Succeeded':
    case 'Ready':
    case 'Up to date':
    case 'Loaded':
    case 'Provisioned as node':
    case 'Preferred':
    case 'Connected':
    case 'Deployed':
      return <SuccessStatus {...statusProps} />;

    case 'Info':
      return <InfoStatus {...statusProps}>{children}</InfoStatus>;

    case 'Unknown':
      return <StatusIconAndText {...statusProps} icon={<UnknownIcon />} />;

    case 'PipelineNotStarted':
      return <StatusIconAndText {...statusProps} icon={<NotStartedIcon />} />;

    default:
      return status ? <StatusIconAndText {...statusProps} /> : <>{DASH}</>;
  }
};

export default Status;
