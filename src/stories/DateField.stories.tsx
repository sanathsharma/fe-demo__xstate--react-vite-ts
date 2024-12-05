import {DateField} from '../components/ui/DateField';

import type {Meta} from '@storybook/react';

const meta: Meta<typeof DateField> = {
  component: DateField,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs']
};

export default meta;

export const Example = (args: any) => <DateField {...args} />;

Example.args = {
  label: 'Event date'
};
