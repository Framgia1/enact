import kind from '@enact/core/kind';
import React from 'react';
import PropTypes from 'prop-types';
import Pure from '@enact/ui/internal/Pure';

import Icon from '../Icon';

import css from './ToggleItem.less';

/**
 * Utility component to render the {@link moonstone/Icon.Icon} for
 * {@link moonstone/ToggleItem.ToggleItem}.
 *
 * @class ToggleIcon
 * @memberof moonstone/ToggleItem
 * @ui
 * @private
 */
const ToggleIconBase = kind({
	name: 'ToggleIcon',

	propTypes: /** @lends moonstone/ToggleItem.ToggleIcon.prototype */ {
		/**
		 * Nothing, a string, or an {@link moonstone/Icon.Icon}
		 *
		 * @type {Node}
		 */
		children: PropTypes.node,

		/**
		 * When `true`, the icon is displayed
		 *
		 * @type {Boolean}
		 */
		selected: PropTypes.bool
	},

	defaultProps: {
		selected: false
	},

	styles: {
		css,
		className: 'icon'
	},

	computed: {
		className: ({selected, styler}) => styler.append({selected})
	},

	render: ({children, ...rest}) => {
		if (children) {
			if (React.isValidElement(children)) {
				return children;
			}
			return (
				<Icon {...rest}>{children}</Icon>
			);
		}

		return null;
	}
});

const ToggleIcon = Pure(
	ToggleIconBase
);

export default ToggleIcon;
export {
	ToggleIcon,
	ToggleIconBase
};
