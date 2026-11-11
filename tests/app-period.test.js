import {createWalkthroughSession,mountFormHelper} from '../src/form-helper.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as domain from '../src/domain.js';
import * as roof from '../src/roof-view.js';

// Exercise the real app's hydration and collection with a minimal DOM boundary.
// This is a state regression test, not a browser or accessibility acceptance test.
const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')
  .replace(/^import[^\n]+\n/gm, '');

function loadApp(savedInput = null) {
  const actions = new Map();
  const element = () => ({
    innerHTML: '', textContent: '',
    classList: {add() {}, remove() {}},
    addEventListener() {}, focus() {}, scrollIntoView() {}, setAttribute() {}
  });
  const app = element();
  const toast = element();
  const edit = {
    dataset: {action: 'edit'},
    addEventListener(event, handler) { actions.set(`edit:${event}`, handler); }
  };
  let form = null;
  class FormDataStub {
    constructor(node) { this.values = node.values; }
    [Symbol.iterator]() { return this.values[Symbol.iterator](); }
    get(key) { return this.values.get(key) ?? null; }
    has(key) { return this.values.has(key); }
  }
  const context = vm.createContext({
    ...domain, ...roof, createWalkthroughSession,mountFormHelper,structuredClone, FormData: FormDataStub,
    document: {
      querySelector(selector) {
        if (selector === '#app') return app;
        if (selector === '#toast') return toast;
        if (selector === '#simulation-form') return form;
        return null;
      },
      querySelectorAll: selector => selector === '[data-action]' ? [edit] : []
    },
    location: {hash: '#simulator'},
    window: {addEventListener() {}, scrollTo() {}},
    localStorage: {getItem: () => savedInput ? JSON.stringify(savedInput) : null},
    setTimeout() { return 0; }, clearTimeout() {}
  });
  vm.runInContext(appSource, context);
  return {
    evaluate: code => vm.runInContext(code, context),
    html: () => app.innerHTML,
    async importInput(input) {
      // Domain replay has its own tests. Stub only this asynchronous boundary.
      context.replayResult = {input: structuredClone(input)};
      vm.runInContext('runWorker = async () => replayResult;', context);
      context.importFile = {size: 2, text: async () => '{}'};
      await vm.runInContext('importJSON(importFile)', context);
    },
    edit: () => actions.get('edit:click')(),
    collectInput() {
      form = element();
      form.values = new Map([
        ['periodMonth', String(vm.runInContext('state.periodMonth', context))],
        ['monthlyValue', String(vm.runInContext('state.monthlyValue', context))],
        ['consent', 'on']
      ]);
      vm.runInContext('collect()', context);
      form = null;
    }
  };
}

const savedInput = (month, extrapolated = true) => ({
  ...structuredClone(domain.DEFAULT_INPUT),
  consumptionSourceMonth: month,
  extrapolated,
  monthlyKwh: Array(12).fill(720)
});

test('reload restores every source month and recollection preserves provenance', () => {
  for (let month = 1; month <= 12; month++) {
    const app = loadApp(savedInput(month));
    assert.equal(app.evaluate('state.periodMonth'), month - 1, `month ${month}`);
    assert.match(app.html(), new RegExp(`<option value="${month - 1}" selected>`));
    app.collectInput();
    assert.equal(app.evaluate('state.input.consumptionSourceMonth'), month);
    assert.equal(app.evaluate('state.input.monthlyKwh[0]'), 720);
  }
});

test('snapshot hydration restores source month instead of keeping the previous UI month', async () => {
  const app = loadApp(savedInput(3));
  await app.importInput(savedInput(11));
  assert.equal(app.evaluate('state.periodMonth'), 10);
  assert.equal(app.evaluate('state.input.consumptionSourceMonth'), 11);
});

test('editing a result reads its source month from the input', async () => {
  const app = loadApp();
  app.evaluate('state.input.consumptionSourceMonth = 6; state.periodMonth = 0;');
  await app.edit();
  assert.equal(app.evaluate('state.periodMonth'), 5);
  app.collectInput();
  assert.equal(app.evaluate('state.input.consumptionSourceMonth'), 6);
});

test('source month restoration leaves full-year data intact and rejects invalid saved input', () => {
  const input = savedInput(9, false);
  input.monthlyKwh = Array.from({length: 12}, (_, index) => 100 + index);
  const fullYear = loadApp(input);
  assert.equal(fullYear.evaluate('state.periodMonth'), 8);
  assert.equal(fullYear.evaluate('state.monthlyMode'), 'full');
  assert.deepEqual(JSON.parse(fullYear.evaluate('JSON.stringify(state.input.monthlyKwh)')), input.monthlyKwh);
  const invalid = loadApp(savedInput(0));
  assert.equal(invalid.evaluate('state.periodMonth'), 0);
  assert.equal(invalid.evaluate('state.input.consumptionSourceMonth'), 1);
});
