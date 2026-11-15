const test = require('node:test');
const assert = require('node:assert/strict');
const { appendCurrentUserMessage } = require('../electron/ipc/chat');

test('does not append a user message that was already persisted', () => {
  const history = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there' },
    { role: 'user', content: 'Next question' },
  ];
  assert.equal(appendCurrentUserMessage(history, 'Next question'), history);
});

test('appends the current user message when it is not already the last turn', () => {
  const history = [{ role: 'user', content: 'Hello' }];
  const result = appendCurrentUserMessage(history, 'Another question');
  assert.equal(result.length, 2);
  assert.deepEqual(result[1], { role: 'user', content: 'Another question' });
});

test('does not treat an earlier matching message as the current turn', () => {
  const history = [
    { role: 'user', content: 'Repeat' },
    { role: 'assistant', content: 'Again?' },
  ];
  assert.equal(appendCurrentUserMessage(history, 'Repeat').length, 3);
});
