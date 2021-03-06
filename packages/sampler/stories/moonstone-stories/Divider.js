import Divider from '@enact/moonstone/Divider';
import React from 'react';
import {storiesOf} from '@kadira/storybook';
import {select, text} from '@kadira/storybook-addon-knobs';

storiesOf('Divider')
	.addWithInfo(
		' ',
		'Basic usage of divider',
		() => (
			<Divider casing={select('casing', ['preserve', 'sentence', 'word', 'upper'], 'word')}>
				{text('children', 'divider text')}
			</Divider>
		)
	);
