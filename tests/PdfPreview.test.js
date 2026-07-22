import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfMocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  loadingDestroy: vi.fn(),
  documentDestroy: vi.fn(),
}));

vi.mock('pdfjs-dist', () => ({
  getDocument: pdfMocks.getDocument,
  GlobalWorkerOptions: {},
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '/pdf.worker.mjs' }));

import PdfPreview from '@/components/preview/PdfPreview.vue';

class ObserverStub {
  static instances = [];

  constructor() {
    this.observe = vi.fn();
    this.disconnect = vi.fn();
    ObserverStub.instances.push(this);
  }
}

async function flushLoad() {
  await flushPromises();
  await nextTick();
  await flushPromises();
  await nextTick();
}

describe('PdfPreview', () => {
  beforeEach(() => {
    ObserverStub.instances = [];
    vi.stubGlobal('IntersectionObserver', ObserverStub);
    pdfMocks.loadingDestroy.mockReset();
    pdfMocks.documentDestroy.mockReset();
    pdfMocks.getDocument.mockReset();
    pdfMocks.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        destroy: pdfMocks.documentDestroy,
        getPage: vi.fn(),
      }),
      destroy: pdfMocks.loadingDestroy,
    });
  });

  it('creates lazy page observers and releases PDF resources on unmount', async () => {
    const blob = new Blob(['pdf']);
    Object.defineProperty(blob, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(3)),
    });
    const wrapper = mount(PdfPreview, { props: { blob } });

    await flushLoad();
    expect(wrapper.findAll('.pdf-page')).toHaveLength(2);
    expect(ObserverStub.instances[0].observe).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    await flushLoad();
    expect(ObserverStub.instances[0].disconnect).toHaveBeenCalled();
    expect(pdfMocks.loadingDestroy).toHaveBeenCalled();
    expect(pdfMocks.documentDestroy).toHaveBeenCalled();
  });
});
