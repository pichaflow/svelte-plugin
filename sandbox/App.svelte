<script lang="ts">
  import { PichaFlowClient, type UploadResponse } from '@pichaflow/sdk';
  import { PichaFlowUpload } from '../src/index';

  const client = new PichaFlowClient({
    apiKey: 'your_api_key_here',
    baseUrl: 'http://localhost:8789',
    uploadUrl: 'http://localhost:8789',
    fetchUrl: 'http://localhost:8789',
  });

  let description = $state('');
  let uploadedImages = $state<UploadResponse[]>([]);
  let deletingId = $state<string | null>(null);

  function handleSuccess(response: UploadResponse) {
    uploadedImages = [
      ...uploadedImages,
      {
        ...response,
        alt: description || response.alt || 'Uploaded image',
      },
    ];
    description = '';
  }

  async function handleDelete(id: string) {
    deletingId = id;
    try {
      const res = await client.deleteAsset(id);
      if (res.success) {
        uploadedImages = uploadedImages.filter((img) => img.id !== id);
      }
    } catch (err) {
      alert(`Failed to delete image: ${err}`);
    } finally {
      deletingId = null;
    }
  }
</script>

<main class="example-container">
  <h2>PichaFlow Svelte Upload Example</h2>

  <!-- 1. Description Input -->
  <div class="input-group">
    <label for="desc-input">Image Description (Alt Text):</label>
    <input
      id="desc-input"
      type="text"
      bind:value={description}
      placeholder="Enter alt text for image"
    />
  </div>

  <!-- 2. PichaFlowUpload Component -->
  <PichaFlowUpload
    apiKey="your_api_key_here"
    baseUrl="http://localhost:8789"
    uploadUrl="http://localhost:8789"
    alt={description}
    directory="examples/svelte"
    tags={['svelte_example']}
    onSuccess={handleSuccess}
    onError={(err) => alert(`Upload error: ${err.message || err}`)}
  />

  <!-- 3. Uploaded Images List -->
  <section class="list-section">
    <h3>Uploaded Images ({uploadedImages.length})</h3>

    {#if uploadedImages.length === 0}
      <p class="empty-text">No images uploaded yet.</p>
    {:else}
      <ul class="image-list">
        {#each uploadedImages as img (img.id)}
          <li class="image-item">
            <img src={img.url} alt={img.alt} class="thumbnail" />
            <div class="info">
              <strong>{img.alt}</strong>
              <span class="id-text">ID: {img.id}</span>
            </div>
            <button
              class="delete-btn"
              disabled={deletingId === img.id}
              onclick={() => handleDelete(img.id)}
            >
              {deletingId === img.id ? 'Deleting...' : 'Delete'}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</main>

<style>
  .example-container {
    max-width: 600px;
    margin: 40px auto;
    font-family: system-ui, sans-serif;
  }
  .input-group {
    margin-bottom: 16px;
  }
  .input-group label {
    display: block;
    margin-bottom: 6px;
    font-weight: 600;
  }
  .input-group input {
    width: 100%;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #ccc;
    box-sizing: border-box;
  }
  .list-section {
    margin-top: 32px;
  }
  .empty-text {
    color: #666;
  }
  .image-list {
    list-style: none;
    padding: 0;
  }
  .image-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid #eee;
    border-radius: 6px;
    margin-bottom: 8px;
  }
  .thumbnail {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 4px;
  }
  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .id-text {
    font-size: 12px;
    color: #888;
  }
  .delete-btn {
    background-color: #ef4444;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
  }
  .delete-btn:disabled {
    opacity: 0.6;
  }
</style>
