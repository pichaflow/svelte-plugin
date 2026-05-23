<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { PichaFlowClient, type UploadResponse } from '@pichaflow/sdk';

  export let apiKey: string;
  export let baseUrl: string | undefined = undefined;
  export let useSecure: boolean = false;
  export let tags: string[] | undefined = undefined;

  const dispatch = createEventDispatcher();
  let isDragging = false;
  let isUploading = false;
  let progress = 0;

  const client = new PichaFlowClient({ apiKey, baseUrl });

  async function handleFile(file: File) {
    if (isUploading) return;
    isUploading = true;
    progress = 0;

    try {
      const options = {
        tags,
        onProgress: (p: number) => {
          progress = p;
          dispatch('progress', p);
        }
      };
      
      const response = useSecure 
        ? await client.secureUpload(file, options)
        : await client.upload(file, options);
        
      dispatch('success', response);
    } catch (err) {
      dispatch('error', err);
    } finally {
      isUploading = false;
    }
  }

  function onDrop(e: DragEvent) {
    isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  }
</script>

<div 
  class="picha-upload-zone"
  class:is-dragging={isDragging}
  on:dragover|preventDefault={() => isDragging = true}
  on:dragleave|preventDefault={() => isDragging = false}
  on:drop|preventDefault={onDrop}
>
  {#if !isUploading}
    <p>
      Drag & drop or <label class="link">browse<input type="file" on:change={(e) => e.target.files[0] && handleFile(e.target.files[0])} hidden /></label>
    </p>
  {:else}
    <div class="progress-bar">
      <div class="progress-fill" style="width: {progress}%"></div>
    </div>
    <p class="status">Uploading... {progress}%</p>
  {/if}
</div>

<style>
  .picha-upload-zone {
    border: 2px dashed #e2e8f0;
    border-radius: 0.75rem;
    padding: 2rem;
    text-align: center;
    background: #f8fafc;
    cursor: pointer;
  }
  .is-dragging { background: #eff6ff; border-color: #3b82f6; }
  .link { color: #3b82f6; font-weight: 600; cursor: pointer; }
  .progress-bar { background: #e2e8f0; height: 0.5rem; border-radius: 999px; overflow: hidden; }
  .progress-fill { background: #3b82f6; height: 100%; transition: width 0.1s ease; }
  .status { font-size: 0.75rem; color: #64748b; margin-top: 0.5rem; }
</style>
