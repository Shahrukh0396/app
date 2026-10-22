import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatGrid } from './StatGrid';

test('StatGrid renders labels and values', () => {
  const html = renderToStaticMarkup(
    React.createElement(StatGrid, {
      items: [
        { label: 'Users', value: 3 },
        { label: 'Documents', value: 12 },
      ],
    }),
  );
  assert.match(html, /Users/);
  assert.match(html, />3</);
  assert.match(html, /Documents/);
  assert.match(html, />12</);
});
