import PichaFlowUpload from '../src/PichaFlowUpload.svelte';

const app = new PichaFlowUpload({
  target: document.getElementById('app')!,
  props: {
    apiKey: 'sandbox_key',
  }
});

export default app;
