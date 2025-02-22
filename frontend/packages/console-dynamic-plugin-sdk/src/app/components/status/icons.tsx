import * as React from 'react';
import { CheckCircleIcon } from '@patternfly/react-icons/dist/esm/icons/check-circle-icon';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import * as classNames from 'classnames';

import './icons.scss';

export type ColoredIconProps = {
  className?: string;
  title?: string;
  size?: number;
};

/**
 * Component for displaying a green check mark circle icon.
 * @param {string} [className] - (optional) additional class name for the component
 * @param {string} [title] - (optional) icon title
 * @param {string} [size] - (optional) icon size: ('sm', 'md', 'lg', 'xl')
 * @example
 * ```tsx
 * <GreenCheckCircleIcon title="Healthy" />
 * ```
 */
export const GreenCheckCircleIcon: React.FC<ColoredIconProps> = ({ className, title, size }) => (
  <CheckCircleIcon
    data-test="success-icon"
    size={size}
    className={classNames('dps-icons__green-check-icon', className)}
    title={title}
  />
);

/**
 * Component for displaying a red exclamation mark circle icon.
 * @param {string} [className] - (optional) additional class name for the component
 * @param {string} [title] - (optional) icon title
 * @param {string} [size] - (optional) icon size: ('sm', 'md', 'lg', 'xl')
 * @example
 * ```tsx
 * <RedExclamationCircleIcon title="Failed" />
 * ```
 */
export const RedExclamationCircleIcon: React.FC<ColoredIconProps> = ({
  className,
  title,
  size,
}) => (
  <ExclamationCircleIcon
    size={size}
    className={classNames('dps-icons__red-exclamation-icon', className)}
    title={title}
  />
);

/**
 * Component for displaying a yellow triangle exclamation icon.
 * @param {string} [className] - (optional) additional class name for the component
 * @param {string} [title] - (optional) icon title
 * @param {string} [size] - (optional) icon size: ('sm', 'md', 'lg', 'xl')
 * @example
 * ```tsx
 * <YellowExclamationTriangleIcon title="Warning" />
 * ```
 */
export const YellowExclamationTriangleIcon: React.FC<ColoredIconProps> = ({
  className,
  title,
  size,
}) => (
  <ExclamationTriangleIcon
    size={size}
    className={classNames('dps-icons__yellow-exclamation-icon', className)}
    title={title}
  />
);

/**
 * Component for displaying a blue info circle icon.
 * @param {string} [className] - (optional) additional class name for the component
 * @param {string} [title] - (optional) icon title
 * @param {string} [size] - (optional) icon size: ('sm', 'md', 'lg', 'xl')
 * @example
 * ```tsx
 * <BlueInfoCircleIcon title="Info" />
 * ```
 */
export const BlueInfoCircleIcon: React.FC<ColoredIconProps> = ({ className, title }) => (
  <InfoCircleIcon className={classNames('dps-icons__blue-info-icon', className)} title={title} />
);
