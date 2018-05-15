import ApiDecorator from '@enact/core/internal/ApiDecorator';
import classNames from 'classnames';
import {Job} from '@enact/core/util';
import PropTypes from 'prop-types';
import React, {Component} from 'react';

import Skinnable from '../Skinnable';

import css from './OverscrollEffect.less';

const timeout = 300;

class OverscrollEffectBase extends Component {
	static displayName = 'OverscrollEffect'

	static propTypes = /** @lends moonstone/Scrollable.OverscrollEffect.prototype */ {
		/**
		 * Indicates which direction of scrolling the overscroll shows for.
		 *
		 * @type {String}
		 * @public
		 */
		orientation: PropTypes.string,

		/**
		 * Indicates where the effect is located in.
		 *
		 * @type {String}
		 * @private
		 */
		position: PropTypes.string,

		/**
		 * Registers the OverscrollEffect component with an
		 * {@link core/internal/ApiDecorator.ApiDecorator}.
		 *
		 * @type {Function}
		 * @private
		 */
		setApiProvider: PropTypes.func
	}

	constructor (props) {
		super(props);

		this.effectJob = new Job(this.step.bind(this), timeout);

		if (props.setApiProvider) {
			props.setApiProvider(this);
		}
	}

	componentWillUnmount () {
		this.effectJob.stop();
	}

	step = (className, add) => {
		this.ref.classList.toggle(className, add);
		this.effectStepFunctions[this.stepCounter++]();
	}

	effectStepFunctions = [
		() => { // shows the effect
			this.effectJob.startAfter(0, css.visible, true);
		},
		() => { // starts expanding
			this.effectJob.startAfter(30, css.expand, true); // timeout is needed to apply CSS transition properly
		},
		() => { // starts shrinking
			this.effectJob.start(css.expand, false);
		},
		() => { // hides the effect
			this.effectJob.start(css.visible, false);
		},
		() => {} // end of steps
	]

	update = () => {
		this.stepCounter = 0;
		this.effectStepFunctions[this.stepCounter]();
	}

	initRef = (ref) => {
		if (ref) {
			this.ref = ref;
		}
	}

	render () {
		const
			{className, position, rtl, orientation, ...rest} = this.props,
			overscrollClasses = classNames(className, css.overscroll, css[orientation], css[position]);

		delete rest.setApiProvider;

		return (
			<div {...rest} className={overscrollClasses} ref={this.initRef} />
		);
	}
}

const OverscrollEffect = ApiDecorator({api: ['update']}, Skinnable(OverscrollEffectBase));

export default OverscrollEffect;
export {
	OverscrollEffect
};
