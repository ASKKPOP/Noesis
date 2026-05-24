import React from 'react';
import { render } from '@testing-library/react';
import ConversationPane from './ConversationPane';

describe('ConversationPane', () => {
    it('renders without crashing when no Nous selected', () => {
        const { container } = render(
            <ConversationPane
                selectedNousId={null}
                messages={[]}
                isLoading={false}
                error={null}
                onSend={() => undefined}
                onTipConfirmed={() => undefined}
            />,
        );
        expect(container).toBeDefined();
    });
});
