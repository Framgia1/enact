/**
 * Exports the {@link module:@enact/moonstone/VirtualList/VirtualListBase~VirtualListBase} component.
 *
 * @module @enact/moonstone/VirtualList/VirtualListBase
 */

import React, {Component, PropTypes} from 'react';

import {Spotlight, SpotlightContainerDecorator} from '@enact/spotlight';

import {dataIndexAttribute, Scrollable} from '../Scroller/Scrollable';

const
	dataContainerDisabledAttribute = 'data-container-disabled',
	dataContainerIdAttribute = 'data-container-id',
	keyLeft	 = 37,
	keyUp	 = 38,
	keyRight = 39,
	keyDown	 = 40,
	nop = () => {};

/**
 * {@link module:@enact/moonstone/VirtualList/VirtualListBase~VirtualListBase} is a base component for
 * {@link module:@enact/moonstone/VirtualList~VirtualList} and
 * {@link module:@enact/moonstone/VirtualList~VirtualGridList} with Scrollable and SpotlightContainerDecorator applied.
 *
 * @class VirtualListBase
 * @mixes module:@enact/moonstone/Scrollable
 * @mixes module:@enact/spotlight/SpotlightContainerDecorator
 * @ui
 * @public
 */
class VirtualListCore extends Component {
	static propTypes = {
		/**
		 * Size of an item for the list; valid values are either a number for `VirtualList`
		 * or an object that has `minWidth` and `minHeight` for `VirtualGridList`.
		 *
		 * @type {Number|Object}
		 * @public
		 */
		itemSize: PropTypes.oneOfType([
			PropTypes.number,
			PropTypes.object
		]).isRequired,

		/**
		 * Callback method of scrollTo.
		 * Normally, `Scrollable` should set this value.
		 *
		 * @type {Function}
		 * @private
		 */
		cbScrollTo: PropTypes.func,

		/**
		 * The render function for an item of the list.
		 * `index` is for accessing the index of the item.
		 * `key` MUST be passed as a prop for DOM recycling.
		 * Data manipulation can be done in this function.
		 *
		 * @type {Function}
		 * @default ({index, key}) => (<div key={key}>{index}</div>)
		 * @public
		 */
		component: PropTypes.func,

		/**
		 * Data for the list.
		 * Check mutation of this and determine whether the list should update or not.
		 *
		 * @type {Any}
		 * @default []
		 * @public
		 */
		data: PropTypes.any,

		/**
		 * Size of the data.
		 *
		 * @type {Number}
		 * @default 0
		 * @public
		 */
		dataSize: PropTypes.number,

		/**
		 * Direction of the list; valid values are `'horizontal'` and `'vertical'`.
		 *
		 * @type {String}
		 * @default 'vertical'
		 * @public
		 */
		direction: PropTypes.oneOf(['horizontal', 'vertical']),

		/**
		 * Called when onScroll [events]{@glossary event} occurs.
		 *
		 * @type {Function}
		 * @private
		 */
		onScroll: PropTypes.func,

		/**
		 * Number of spare DOM node.
		 * `3` is good for the default value experimentally and
		 * this value is highly recommended not to be changed by developers.
		 *
		 * @type {Number}
		 * @default 3
		 * @private
		 */
		overhang: PropTypes.number,

		/**
		 * Option for positioning the items; valid values are `'byItem'`, `'byContainer'`,
		 * and `'byBrowser'`.
		 * If `'byItem'`, the list moves each item.
		 * If `'byContainer'`, the list moves the container that contains rendered items.
		 * If `'byBrowser'`, the list scrolls by browser.
		 *
		 * @type {String}
		 * @default 'byItem'
		 * @private
		 */
		positioningOption: PropTypes.oneOf(['byItem', 'byContainer', 'byBrowser']),

		/**
		 * Spacing between items.
		 *
		 * @type {Number}
		 * @default 0
		 * @public
		 */
		spacing: PropTypes.number
	}

	static defaultProps = {
		cbScrollTo: nop,
		component: ({index, key}) => (<div key={key}>{index}</div>),
		data: [],
		dataSize: 0,
		direction: 'vertical',
		onScroll: nop,
		overhang: 3,
		positioningOption: 'byItem',
		spacing: 0,
		style: {}
	}

	scrollBounds = {
		clientWidth: 0,
		clientHeight: 0,
		scrollWidth: 0,
		scrollHeight: 0,
		maxLeft: 0,
		maxTop: 0
	}

	primary = null
	secondary = null

	isPrimaryDirectionVertical = true
	isItemSized = false

	dimensionToExtent = 0
	primaryThreshold = 0
	secondaryThreshold = {}
	maxPrimaryFirstIndex = 0
	secondaryPositionX = []
	curDataSize = 0
	cc = []
	scrollPosition = 0

	containerRef = null
	wrapperRef = null
	composeItemPosition = null
	positionContainer = null
	job = null

	// spotlight
	nodeIndexToBeBlurred = null
	lastFocusedIndex = null

	constructor (props) {
		const {positioningOption} = props;

		super(props);

		this.state = {
			primaryFirstIndex: 0,
			secondaryFirstIndexes: [],
			secondaryLastIndexes: [],
			numOfItems: 0
		};
		this.initContainerRef = this.initRef('containerRef');
		this.initWrapperRef = this.initRef('wrapperRef');

		switch (positioningOption) {
			case 'byItem':
				this.composeItemPosition = this.composeTransform;
				this.positionContainer = nop;
				break;
			case 'byContainer':
				this.composeItemPosition = this.composeLeftTop;
				this.positionContainer = this.applyTransformToContainerNode;
				break;
			case 'byBrowser':
				this.composeItemPosition = this.composeLeftTop;
				this.positionContainer = this.applyScrollLeftTopToWrapperNode;
				break;
		}
	}

	isVertical = () => true // this.isPrimaryDirectionVertical

	isHorizontal = () => true // !this.isPrimaryDirectionVertical

	getScrollBounds = () => this.scrollBounds

	getGridPosition (index) {
		const
			{dimensionToExtent, primary, secondary} = this,
			primaryPosition = Math.floor(index / dimensionToExtent) * primary.gridSize,
			secondaryPosition = (index % dimensionToExtent) * secondary.gridSize;

		return {primaryPosition, secondaryPosition};
	}

	getItemPosition = (index) => this.gridPositionToItemPosition(this.getGridPosition(index))

	gridPositionToItemPosition = ({primaryPosition, secondaryPosition}) =>
		(this.isPrimaryDirectionVertical ? {left: secondaryPosition, top: primaryPosition} : {left: primaryPosition, top: secondaryPosition})

	getContainerNode = (positioningOption) => {
		if (positioningOption === 'byItem') {
			return this.containerRef;
		} else {
			return this.wrapperRef;
		}
	}

	getClientSize = (node) => {
		return {
			clientWidth: node.clientWidth,
			clientHeight: node.clientHeight
		};
	}

	calculateMetrics (props) {
		const
			{direction, itemSize, positioningOption, spacing} = props,
			node = this.getContainerNode(positioningOption);

		if (!node) {
			return;
		}

		const
			{clientWidth, clientHeight} = this.getClientSize(node),
			heightInfo = {
				clientSize: clientHeight,
				minItemSize: (itemSize.minHeight) ? itemSize.minHeight : null,
				itemSize: itemSize
			},
			widthInfo = {
				clientSize: clientWidth,
				minItemSize: (itemSize.minWidth) ? itemSize.minWidth : null,
				itemSize: itemSize
			};
		let
			primary, secondary, dimensionToExtent, primaryThresholdBase;

		this.isPrimaryDirectionVertical = (direction === 'vertical');

		if (this.isPrimaryDirectionVertical) {
			primary = heightInfo;
			secondary = widthInfo;
		} else {
			primary = widthInfo;
			secondary = heightInfo;
		}
		dimensionToExtent = 1;

		this.isItemSized = (primary.minItemSize && secondary.minItemSize);

		if (this.isItemSized) {
			// the number of columns is the ratio of the available width plus the spacing
			// by the minimum item width plus the spacing
			dimensionToExtent = Math.max(Math.floor((secondary.clientSize + spacing) / (secondary.minItemSize + spacing)), 1);
			// the actual item width is a ratio of the remaining width after all columns
			// and spacing are accounted for and the number of columns that we know we should have
			secondary.itemSize = Math.round((secondary.clientSize - (spacing * (dimensionToExtent - 1))) / dimensionToExtent);
			// the actual item height is related to the item width
			primary.itemSize = Math.round(primary.minItemSize * (secondary.itemSize / secondary.minItemSize));
		}

		primary.gridSize = primary.itemSize + spacing;
		secondary.gridSize = secondary.itemSize + spacing;
		primaryThresholdBase = primary.gridSize * 2;

		this.primaryThreshold = {min: -Infinity, max: primaryThresholdBase, base: primaryThresholdBase};
		this.dimensionToExtent = dimensionToExtent;

		this.primary = primary;
		this.secondary = secondary;

		// reset
		this.scrollPosition = 0;
		// eslint-disable-next-line react/no-direct-mutation-state
		this.state.primaryFirstIndex = 0;
		// eslint-disable-next-line react/no-direct-mutation-state
		this.state.numOfItems = 0;

		if (this.props.directionOption === 'verticalFixedHorizontalVariable') {
			const
				{dataSize, overhang} = this.props,
				numOfItems = Math.min(dataSize, this.dimensionToExtent * (Math.ceil(this.primary.clientSize / this.primary.gridSize) + overhang));
			this.secondaryThreshold.prev = Array(numOfItems);
			this.secondaryThreshold.next = Array(numOfItems);
			this.secondaryPositionX = Array(numOfItems);

			this.scrollPosition = {x: 0, y: 0};

			this.initSecondaryThreshold(0, 0);
		}
	}

	// variable secondaryThreshold
	initSecondaryThreshold (updateFrom, x) {
		let isStateUpdated = false;

		if (this.props.directionOption === 'verticalFixedHorizontalVariable') {
			const
				{component, data, dataSize, directionOption, overhang} = this.props,
				numOfItems = Math.min(dataSize, this.dimensionToExtent * (Math.ceil(this.primary.clientSize / this.primary.gridSize) + overhang)),
				{getWidth, render} = component;

			let accumulatedIndex = 0;

			for (let i = updateFrom; i < updateFrom + numOfItems; i++) {
				let
					accumulatedSize = 0,
					width;

				this.secondaryPositionX[i] = [];

				for (let j = 0; j < data[i].length; j++) {
					width = getWidth({primaryIndex: i, secondaryIndex: j});
					if (!this.secondaryPositionX[i][j]) {
						this.secondaryPositionX[i][j] = accumulatedSize;
					}
					if (accumulatedSize <= x && accumulatedSize + width > x) {
						if (this.state.secondaryFirstIndexes[i] !== j) {
							isStateUpdated = true;
							this.state.secondaryFirstIndexes[i] = j;
							// start = j;
							// this.state.secondaryFirstIndexes = [
							// 	...this.state.secondaryFirstIndexes.slice(0, i),
							// 	j,
							// 	...this.state.secondaryFirstIndexes.slice(i + 1)
							// ];
						}
					}
					if (accumulatedSize + width > x + this.secondary.clientSize) {
						if (this.state.secondaryLastIndexes[i] !== j + 1) {
							isStateUpdated = true;
							this.state.secondaryLastIndexes[i] = j + 1;

							// this.state.secondaryLastIndexes[i] = [
							// 	...this.state.secondaryLastIndexes.slice(0, i),
							// 	j + 1,
							// 	...this.state.secondaryLastIndexes.slice(i + 1)
							// ];
						}
						accumulatedIndex += (j + 1 + 1);
						break;
					}
					accumulatedSize += width;
				}

				this.secondaryThreshold.prev[i] = {
					min: 0,
					max: getWidth({primaryIndex: i, secondaryIndex: 0}),
					base: this.secondary.clientSize // TBD
				};
				this.secondaryThreshold.next[i] = {
					min: accumulatedSize,
					max: accumulatedSize + width,
					base: this.secondary.clientSize // TBD
				};
			}
		}

		return isStateUpdated;
	}

	updateStatesAndBounds (props) {
		const
			{dataSize, overhang} = props,
			{dimensionToExtent, primary} = this,
			numOfItems = Math.min(dataSize, dimensionToExtent * (Math.ceil(primary.clientSize / primary.gridSize) + overhang));

		this.maxPrimaryFirstIndex = dataSize - numOfItems;
		this.curDataSize = dataSize;

		this.setState({primaryFirstIndex: Math.min(this.state.primaryFirstIndex, this.maxPrimaryFirstIndex), numOfItems});
		this.calculateScrollBounds(props);
	}

	calculateScrollBounds (props) {
		const node = this.getContainerNode(props.positioningOption);

		if (!node) {
			return;
		}

		const
			{clientWidth, clientHeight} = this.getClientSize(node),
			{scrollBounds, isPrimaryDirectionVertical} = this;
		let maxPos;

		scrollBounds.clientWidth = clientWidth;
		scrollBounds.clientHeight = clientHeight;
		if (this.props.directionOption === 'verticalFixedHorizontalVariable') {
			scrollBounds.scrollWidth = this.props.clientSize.width;
			scrollBounds.scrollHeight = this.getScrollHeight();
		} else {
			scrollBounds.scrollWidth = this.getScrollWidth();
			scrollBounds.scrollHeight = this.getScrollHeight();
		}
		scrollBounds.maxLeft = Math.max(0, scrollBounds.scrollWidth - clientWidth);
		scrollBounds.maxTop = Math.max(0, scrollBounds.scrollHeight - clientHeight);

		// correct position
		maxPos = isPrimaryDirectionVertical ? scrollBounds.maxTop : scrollBounds.maxLeft;

		this.syncPrimaryThreshold(maxPos);

		if (this.scrollPosition > maxPos) {
			this.props.cbScrollTo({position: (isPrimaryDirectionVertical) ? {y: maxPos} : {x: maxPos}});
		}
	}

	syncPrimaryThreshold (maxPos) {
		const {primaryThreshold} = this;

		if (primaryThreshold.max > maxPos) {
			if (maxPos < primaryThreshold.base) {
				primaryThreshold.max = primaryThreshold.base;
				primaryThreshold.min = -Infinity;
			} else {
				primaryThreshold.max = maxPos;
				primaryThreshold.min = maxPos - primaryThreshold.base;
			}
		}
	}

	setScrollPosition (x, y, dirX, dirY, skipPositionContainer = false) {
		const
			{directionOption} = this.props,
			{primaryFirstIndex} = this.state,
			{isPrimaryDirectionVertical, primaryThreshold, secondaryFirstIndexes, dimensionToExtent, maxPrimaryFirstIndex, scrollBounds} = this,
			{gridSize} = this.primary,
			maxPos = isPrimaryDirectionVertical ? scrollBounds.maxTop : scrollBounds.maxLeft,
			minOfMax = primaryThreshold.base,
			maxOfMin = maxPos - minOfMax;
		let
			delta,
			numOfGridLines,
			newPrimaryFirstIndex = primaryFirstIndex,
			newSecondaryFirstIndexes = secondaryFirstIndexes,
			pos,
			dir = 0,
			isStateUpdated;

		if (this.props.directionOption === 'verticalFixedHorizontalVariable') {
			dir = undefined;
		} else if (isPrimaryDirectionVertical) {
			pos = y;
			dir = dirY;
		} else {
			pos = x;
			dir = dirX;
		}

		if (this.props.directionOption === 'verticalFixedHorizontalVariable') {
			pos = y;
			dir = dirY;

			if (dir === 1 && pos > primaryThreshold.max) {
				delta = pos - primaryThreshold.max;
				numOfGridLines = Math.ceil(delta / gridSize); // how many lines should we add
				primaryThreshold.max = Math.min(maxPos, primaryThreshold.max + numOfGridLines * gridSize);
				primaryThreshold.min = Math.min(maxOfMin, primaryThreshold.max - gridSize);
				newPrimaryFirstIndex = Math.min(maxPrimaryFirstIndex, (dimensionToExtent * Math.ceil(primaryFirstIndex / dimensionToExtent)) + (numOfGridLines * dimensionToExtent));
			} else if (dir === -1 && pos < primaryThreshold.min) {
				delta = primaryThreshold.min - pos;
				numOfGridLines = Math.ceil(delta / gridSize);
				primaryThreshold.max = Math.max(minOfMax, primaryThreshold.min - (numOfGridLines * gridSize - gridSize));
				primaryThreshold.min = (primaryThreshold.max > minOfMax) ? primaryThreshold.max - gridSize : -Infinity;
				newPrimaryFirstIndex = Math.max(0, (dimensionToExtent * Math.ceil(primaryFirstIndex / dimensionToExtent)) - (numOfGridLines * dimensionToExtent));
			}

			pos = x;
			dir = dirX;

			if (primaryFirstIndex === newPrimaryFirstIndex) {
				/*
			if (dir === 1 && pos > primaryThreshold.max) {
				delta = pos - primaryThreshold.max;
				numOfGridLines = Math.ceil(delta / gridSize); // how many lines should we add
				primaryThreshold.max = Math.min(maxPos, primaryThreshold.max + numOfGridLines * gridSize);
				primaryThreshold.min = Math.min(maxOfMin, primaryThreshold.max - gridSize);
				newPrimaryFirstIndex = Math.min(maxPrimaryFirstIndex, (dimensionToExtent * Math.ceil(primaryFirstIndex / dimensionToExtent)) + (numOfGridLines * dimensionToExtent));
			} else if (dir === -1 && pos < primaryThreshold.min) {
				delta = primaryThreshold.min - pos;
				numOfGridLines = Math.ceil(delta / gridSize);
				primaryThreshold.max = Math.max(minOfMax, primaryThreshold.min - (numOfGridLines * gridSize - gridSize));
				primaryThreshold.min = (primaryThreshold.max > minOfMax) ? primaryThreshold.max - gridSize : -Infinity;
				newPrimaryFirstIndex = Math.max(0, (dimensionToExtent * Math.ceil(primaryFirstIndex / dimensionToExtent)) - (numOfGridLines * dimensionToExtent));
			}
				*/
				isStateUpdated = this.initSecondaryThreshold(primaryFirstIndex, pos);
			}



			pos = {x: x, y: y};
		} else if (dir === 1 && pos > primaryThreshold.max) {
			delta = pos - primaryThreshold.max;
			numOfGridLines = Math.ceil(delta / gridSize); // how many lines should we add
			primaryThreshold.max = Math.min(maxPos, primaryThreshold.max + numOfGridLines * gridSize);
			primaryThreshold.min = Math.min(maxOfMin, primaryThreshold.max - gridSize);
			newPrimaryFirstIndex = Math.min(maxPrimaryFirstIndex, (dimensionToExtent * Math.ceil(primaryFirstIndex / dimensionToExtent)) + (numOfGridLines * dimensionToExtent));
		} else if (dir === -1 && pos < primaryThreshold.min) {
			delta = primaryThreshold.min - pos;
			numOfGridLines = Math.ceil(delta / gridSize);
			primaryThreshold.max = Math.max(minOfMax, primaryThreshold.min - (numOfGridLines * gridSize - gridSize));
			primaryThreshold.min = (primaryThreshold.max > minOfMax) ? primaryThreshold.max - gridSize : -Infinity;
			newPrimaryFirstIndex = Math.max(0, (dimensionToExtent * Math.ceil(primaryFirstIndex / dimensionToExtent)) - (numOfGridLines * dimensionToExtent));
		}

		this.syncPrimaryThreshold(maxPos);
		this.scrollPosition = pos;

		if (!skipPositionContainer) {
			this.positionContainer();
		}

		if (primaryFirstIndex !== newPrimaryFirstIndex || isStateUpdated === true) {
			if (this.props.directionOption === 'verticalFixedHorizontalVariable') {
				this.initSecondaryThreshold(newPrimaryFirstIndex, x);
			}
			this.setState({primaryFirstIndex: newPrimaryFirstIndex});
		} else {
			this.positionItems(this.applyStyleToExistingNode, this.determineUpdatedNeededIndices(primaryFirstIndex));
		}
	}

	determineUpdatedNeededIndices (oldPrimaryFirstIndex) {
		const
			{positioningOption} = this.props,
			{primaryFirstIndex, numOfItems} = this.state;

		if (positioningOption === 'byItem') {
			return {
				updateFrom: primaryFirstIndex,
				updateTo: primaryFirstIndex + numOfItems
			};
		} else {
			const diff = primaryFirstIndex - oldPrimaryFirstIndex;
			return {
				updateFrom: (0 < diff && diff < numOfItems ) ? oldPrimaryFirstIndex + numOfItems : primaryFirstIndex,
				updateTo: (-numOfItems < diff && diff <= 0 ) ? oldPrimaryFirstIndex : primaryFirstIndex + numOfItems
			};
		}
	}

	applyStyleToExistingNode = (params) => {
		const
			{directionOption} = this.props,
			{i, key, primaryPosition, secondaryPosition, width, height} = params,
			node = this.containerRef.children[key];

		if (node) {
			// spotlight
			node.setAttribute(dataIndexAttribute, (directionOption === 'verticalFixedHorizontalVariable') ? key : i);
			if (key === this.nodeIndexToBeBlurred && i !== this.lastFocusedIndex) {
				node.blur();
				this.nodeIndexToBeBlurred = null;
			}
			this.composeStyle(node.style, primaryPosition, secondaryPosition, width, height);
		}
	}

	applyStyleToNewNode = (params) => {
		const
			{i, j, key, primaryPosition, secondaryPosition, width, height} = params,
			{component, directionOption} = this.props,
			{numOfItems} = this.state,
			itemElement = (directionOption === 'verticalFixedHorizontalVariable') ?
				component.render({
					index: {primaryIndex: i, secondaryIndex: j},
					key: i + '-' + j
				}) :
				component({
					index: i,
					key: key
				}),
			style = {};

		this.composeStyle(style, primaryPosition, secondaryPosition, width, height);

		this.cc[key] = React.cloneElement(
			itemElement, {
				style: {...itemElement.props.style, ...style},
				[dataIndexAttribute]: (directionOption === 'verticalFixedHorizontalVariable') ? key : i,
			}
		);
	}

	positionItems (applyStyle, {updateFrom, updateTo}) {
		const
			{positioningOption, directionOption} = this.props,
			{numOfItems} = this.state,
			{isPrimaryDirectionVertical, dimensionToExtent, primary, secondary, scrollPosition} = this;

		// we only calculate position of the first child
		let
			{primaryPosition, secondaryPosition} = this.getGridPosition(updateFrom),
			width,
			height,
			key = 0,
			j;

		if (directionOption === 'verticalFixedHorizontalVariable') {
			primaryPosition -= (positioningOption === 'byItem') ? scrollPosition.y : 0;
			secondaryPosition -= (positioningOption === 'byItem') ? scrollPosition.x : 0;
			width = (isPrimaryDirectionVertical ? secondary.itemSize : primary.itemSize) + 'px';
			height = (isPrimaryDirectionVertical ? primary.itemSize : secondary.itemSize) + 'px';
		} else {
			primaryPosition -= (positioningOption === 'byItem') ? scrollPosition : 0;
			width = (isPrimaryDirectionVertical ? secondary.itemSize : primary.itemSize) + 'px';
			height = (isPrimaryDirectionVertical ? primary.itemSize : secondary.itemSize) + 'px';

			j = updateFrom % dimensionToExtent
		}
		// positioning items
		for (let i = updateFrom; i < updateTo; i++) {
			if (directionOption === 'verticalFixedHorizontalVariable') {
				let position = secondaryPosition + this.secondaryPositionX[i][this.state.secondaryFirstIndexes[i]];

				for (j = this.state.secondaryFirstIndexes[i]; j <= this.state.secondaryLastIndexes[i]; j++) {
					const
						{getWidth} = this.props.component,
						width = getWidth({primaryIndex: i, secondaryIndex: j});

					applyStyle.call(this, {i, j, key, primaryPosition, secondaryPosition: position, width, height: this.props.itemSize});

					position += width;
					key++;
				}
				primaryPosition += primary.gridSize;
			} else {
				key = i % numOfItems;
				applyStyle.call(this, {i, key, primaryPosition, secondaryPosition, width, height});

				if (++j === dimensionToExtent) {
					secondaryPosition = 0;
					primaryPosition += primary.gridSize;
					j = 0;
				} else {
					secondaryPosition += secondary.gridSize;
				}
			}
		}
	}

	composeStyle (style, primary, secondary, width, height) {
		if (this.isItemSized || this.props.directionOption === 'verticalFixedHorizontalVariable') {
			style.width = width;
			style.height = height;
		}
		this.composeItemPosition(style, primary, secondary);
	}

	getXY = (primary, secondary) => ((this.isPrimaryDirectionVertical) ? {x: secondary, y: primary} : {x: primary, y: secondary})

	composeTransform (style, primary, secondary = 0) {
		const {x, y} = this.getXY(primary, secondary);
		style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
	}

	composeLeftTop (style, primary, secondary = 0) {
		const {x, y} = this.getXY(primary, secondary);
		style.left = x + 'px';
		style.top = y + 'px';
	}

	applyTransformToContainerNode () {
		this.composeTransform(this.containerRef.style, -this.scrollPosition, 0);
	}

	applyScrollLeftTopToWrapperNode () {
		const
			node = this.wrapperRef,
			{x, y} = this.getXY(this.scrollPosition, 0);
		node.scrollLeft = x;
		node.scrollTop = y;
	}

	composeOverflow (style) {
		style[this.isPrimaryDirectionVertical ? 'overflowY' : 'overflowX'] = 'scroll';
	}

	getScrollHeight = () => (this.isPrimaryDirectionVertical ? this.getVirtualScrollDimension() : this.scrollBounds.clientHeight)

	getScrollWidth = () => (this.isPrimaryDirectionVertical ? this.scrollBounds.clientWidth : this.getVirtualScrollDimension())

	getVirtualScrollDimension = () => {
		const
			{dimensionToExtent, primary, curDataSize} = this,
			{spacing} = this.props;

		return (Math.ceil(curDataSize / dimensionToExtent) * primary.gridSize) - spacing;
	}

	calculatePositionOnFocus = (focusedIndex) => {
		const
			{primary, numOfItems, scrollPosition} = this,
			offsetToClientEnd = primary.clientSize - primary.itemSize;
		let
			gridPosition = this.getGridPosition(focusedIndex);

		this.nodeIndexToBeBlurred = this.lastFocusedIndex % numOfItems;
		this.lastFocusedIndex = focusedIndex;

		if (primary.clientSize >= primary.itemSize) {
			if (gridPosition.primaryPosition > scrollPosition + offsetToClientEnd) {
				gridPosition.primaryPosition -= offsetToClientEnd;
			} else if (gridPosition.primaryPosition > scrollPosition) {
				gridPosition.primaryPosition = scrollPosition;
			}
		}

		// Since the result is used as a target position to be scrolled,
		// scrondaryPosition should be 0 here.
		gridPosition.secondaryPosition = 0;
		return this.gridPositionToItemPosition(gridPosition);
	}

	setRestrict = (bool) => {
		Spotlight.set(this.props[dataContainerIdAttribute], {restrict: (bool) ? 'self-only' : 'self-first'});
	}

	setSpotlightContainerRestrict = (keyCode, index) => {
		const
			{dataSize} = this.props,
			{isPrimaryDirectionVertical, dimensionToExtent} = this,
			canMoveBackward = index >= dimensionToExtent,
			canMoveForward = index < (dataSize - (((dataSize - 1) % dimensionToExtent) + 1));
		let isSelfOnly = false;

		if (isPrimaryDirectionVertical) {
			if (keyCode === keyUp && canMoveBackward || keyCode === keyDown && canMoveForward) {
				isSelfOnly = true;
			}
		} else if (keyCode === keyLeft && canMoveBackward || keyCode === keyRight && canMoveForward) {
			isSelfOnly = true;
		}

		this.setRestrict(isSelfOnly);
	}

	setContainerDisabled = (bool) => {
		const containerNode = this.getContainerNode(this.props.positioningOption);

		if (containerNode) {
			containerNode.setAttribute(dataContainerDisabledAttribute, bool);
		}
	}

	updateClientSize = () => {
		const
			{positioningOption} = this.props,
			node = this.getContainerNode(positioningOption);

		if (!node) {
			return;
		}

		const
			{isPrimaryDirectionVertical, primary} = this,
			{clientWidth, clientHeight} = this.getClientSize(node);

		if (isPrimaryDirectionVertical) {
			primary.clientSize = clientHeight;
		} else {
			primary.clientSize = clientWidth;
		}

		this.updateStatesAndBounds(this.props);
	}

	// Calculate metrics for VirtualList after the 1st render to know client W/H.
	// We separate code related with data due to re use it when data changed.
	componentDidMount () {
		const {positioningOption} = this.props;

		this.calculateMetrics(this.props);
		this.updateStatesAndBounds(this.props);

		if (positioningOption !== 'byBrowser') {
			const containerNode = this.getContainerNode(positioningOption);

			// prevent native scrolling by Spotlight
			this.preventScroll = function () {
				containerNode.scrollTop = 0;
				containerNode.scrollLeft = 0;
			};

			if (containerNode && containerNode.addEventListener) {
				containerNode.addEventListener('scroll', this.preventScroll);
			}
		}
	}

	// Call updateStatesAndBounds here when dataSize has been changed to update nomOfItems state.
	// Calling setState within componentWillReceivePropswill not trigger an additional render.
	componentWillReceiveProps (nextProps) {
		const
			{direction, itemSize, dataSize, overhang, spacing} = this.props,
			hasMetricsChanged = (
				direction !== nextProps.direction ||
				((itemSize instanceof Object) ? (itemSize.minWidth !== nextProps.itemSize.minWidth || itemSize.minHeight !== nextProps.itemSize.minHeight) : itemSize !== nextProps.itemSize) ||
				overhang !== nextProps.overhang ||
				spacing !== nextProps.spacing
			),
			hasDataChanged = (dataSize !== nextProps.dataSize);

		if (hasMetricsChanged) {
			this.calculateMetrics(nextProps);
			this.updateStatesAndBounds(hasDataChanged ? nextProps : this.props);
		} else if (hasDataChanged) {
			this.updateStatesAndBounds(nextProps);
		}
	}

	componentWillUnmount () {
		const containerNode = this.getContainerNode(this.props.positioningOption);

		// remove a function for preventing native scrolling by Spotlight
		if (containerNode && containerNode.removeEventListener) {
			containerNode.removeEventListener('scroll', this.preventScroll);
		}
	}

	// render

	initRef (prop) {
		return (ref) => {
			this[prop] = ref;
		};
	}

	renderCalculate () {
		const
			{dataSize, directionOption} = this.props,
			{primaryFirstIndex, numOfItems} = this.state,
			max = Math.min(dataSize, primaryFirstIndex + numOfItems);

		this.cc.length = 0;
		this.positionItems(this.applyStyleToNewNode, {updateFrom: primaryFirstIndex, updateTo: max});
		this.positionContainer();
	}

	render () {
		const
			props = Object.assign({}, this.props),
			{positioningOption, onScroll} = this.props,
			{primary, cc} = this;

		delete props.cbScrollTo;
		delete props.component;
		delete props.data;
		delete props.dataSize;
		delete props.direction;
		delete props.hideScrollbars;
		delete props.itemSize;
		delete props.onScroll;
		delete props.onScrolling;
		delete props.onScrollStart;
		delete props.onScrollStop;
		delete props.overhang;
		delete props.positioningOption;
		delete props.spacing;

		if (primary) {
			this.renderCalculate();
		}

		if (positioningOption === 'byItem') {
			return (
				<div {...props} ref={this.initContainerRef}>
					{cc}
				</div>
			);
		} else {
			const {className, style, ...rest} = props;

			if (positioningOption === 'byBrowser') {
				this.composeOverflow(style);
			}

			return (
				<div ref={this.initWrapperRef} className={className} style={style} onScroll={onScroll}>
					<div {...rest} ref={this.initContainerRef}>
						{cc}
					</div>
				</div>
			);
		}
	}
}

const VirtualListBase = SpotlightContainerDecorator({restrict: 'self-first'}, Scrollable(VirtualListCore));

export default VirtualListBase;
export {VirtualListCore, VirtualListBase};
