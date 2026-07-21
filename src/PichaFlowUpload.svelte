<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    PichaFlowClient,
    type UploadResponse,
    optimizeImageForUpload,
  } from "@pichaflow/sdk";

  export let apiKey: string | undefined = undefined;
  export let baseUrl: string | undefined = undefined;
  export let uploadUrl: string | undefined = undefined;
  export let fetchUrl: string | undefined = undefined;
  export let tenantId: string | undefined = undefined;
  export let signatureUrl: string | undefined = undefined;
  export let customUploadEndpoint: string | undefined = undefined;
  export let useSecure: boolean = false;
  export let tags: string[] | undefined = undefined;
  export let directory: string | undefined = undefined;
  export let allowDeletion: boolean = true;
  export let multiple: boolean = true;

  const dispatch = createEventDispatcher();
  let isDragging = false;
  let fileInput: HTMLInputElement;

  type UploadTask = {
    id: string;
    file: File;
    previewUrl: string;
    progress: number;
    status:
      | "pending"
      | "uploading"
      | "success"
      | "error"
      | "deleting"
      | "deleted";
    error?: string;
    response?: UploadResponse;
  };

  let tasks: UploadTask[] = [];

  const config: Record<string, any> = {};
  if (apiKey !== undefined) config.apiKey = apiKey;
  if (baseUrl !== undefined) config.baseUrl = baseUrl;
  if (uploadUrl !== undefined) config.uploadUrl = uploadUrl;
  if (fetchUrl !== undefined) config.fetchUrl = fetchUrl;
  if (tenantId !== undefined) config.tenantId = tenantId;
  if (signatureUrl !== undefined) config.signatureUrl = signatureUrl;
  if (customUploadEndpoint !== undefined)
    config.customUploadEndpoint = customUploadEndpoint;

  const client = new PichaFlowClient(config as any);

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files) as File[];
    if (fileArray.length === 0) return;

    const imageFiles = fileArray.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      dispatch("error", new Error("Only image files are supported."));
      return;
    }

    const filesToUpload = multiple ? imageFiles : [imageFiles[0]];

    if (!multiple) {
      // Clear/delete existing tasks
      tasks.forEach(t => {
        if (t.response?.id && allowDeletion) {
          client.deleteAsset(t.response.id).catch(() => {});
        }
      });
      tasks = [];
    }

    const previewTasks: UploadTask[] = filesToUpload.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: "pending" as const,
    }));

    tasks = multiple ? [...tasks, ...previewTasks] : previewTasks;

    let completedCount = 0;
    const successfulResponses: UploadResponse[] = [];

    await Promise.all(
      previewTasks.map(async (task) => {
        const updateTask = (updates: Partial<UploadTask>) => {
          const index = tasks.findIndex((t) => t.id === task.id);
          if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            tasks = [...tasks]; // trigger reactivity
          }
        };

        try {
          const optimizedFile = await optimizeImageForUpload(task.file);
          updateTask({ status: "uploading", file: optimizedFile });

          const options = {
            tags,
            directory,
            signatureUrl,
            customUploadEndpoint,
            onProgress: (p: number) => {
              updateTask({ progress: p });
              dispatch("progress", p);
            },
          };

          const response = useSecure
            ? await client.secureUpload(optimizedFile, options)
            : await client.upload(optimizedFile, options);

          updateTask({ status: "success", progress: 100, response });
          successfulResponses.push(response);
          dispatch("success", response);
        } catch (err: any) {
          updateTask({
            status: "error",
            error: err.message || "Upload failed",
          });
          dispatch("error", err);
        } finally {
          completedCount++;
          if (completedCount === previewTasks.length) {
            if (successfulResponses.length > 0) {
              dispatch("success-all", successfulResponses);
            }
          }
        }
      }),
    );
  }

  function onDrop(e: DragEvent) {
    isDragging = false;
    const files = e.dataTransfer?.files;
    if (files && files.length) handleFiles(files);
  }

  async function handleDelete(taskId: string, assetId: string) {
    if (!window.confirm("Are you sure you want to delete this file?")) {
      return;
    }

    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) return;

    tasks[index].status = "deleting";
    tasks = [...tasks];

    try {
      await client.deleteAsset(assetId);
      tasks = tasks.filter((t) => t.id !== taskId);
      dispatch("delete", assetId);
    } catch (err: any) {
      const errorIndex = tasks.findIndex((t) => t.id === taskId);
      if (errorIndex !== -1) {
        tasks[errorIndex].status = "success";
        tasks = [...tasks];
      }
      dispatch("delete-error", err);
    }
  }

  async function handleRemoveAll() {
    if (!window.confirm("Are you sure you want to remove all files?")) {
      return;
    }
    const uploadedTasks = tasks.filter(t => t.response?.id);
    tasks = [];
    if (allowDeletion) {
      await Promise.all(uploadedTasks.map(t => client.deleteAsset(t.response!.id).catch(() => {})));
    }
  }

  function handleClearSingle() {
    if (tasks.length > 0) {
      const task = tasks[0];
      if (task.response?.id && allowDeletion) {
        if (!window.confirm("Are you sure you want to delete this file?")) {
          return;
        }
        client.deleteAsset(task.response.id).catch(() => {});
      }
      tasks = [];
    }
  }

  function onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length) {
      handleFiles(input.files);
    }
    input.value = ""; // Reset input
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
</script>

<div class="picha-container">
  <div
    class="picha-upload-zone"
    class:is-dragging={isDragging}
    on:dragover|preventDefault={() => (isDragging = true)}
    on:dragleave|preventDefault={() => (isDragging = false)}
    on:drop|preventDefault={onDrop}
    on:click={() => fileInput.click()}
  >
    <div class="picha-upload-circle">
      <slot name="icon">
        <svg
          class="picha-upload-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          ></path></svg
        >
      </slot>
    </div>
    <p class="picha-upload-title">{multiple ? 'Upload files' : 'Upload file'}</p>
    <p class="picha-upload-description">Drag & drop or <span class="picha-upload-link">browse</span></p>
    <input
      type="file"
      accept="image/*"
      bind:this={fileInput}
      multiple={multiple}
      on:change={onFileSelect}
      hidden
    />
    {#if !multiple && tasks.length > 0}
      <button type="button" class="picha-upload-remove-current" on:click|stopPropagation={handleClearSingle}>
        Remove the current file to upload a new one.
      </button>
    {/if}
  </div>

  {#if tasks.length > 0}
    <div class="picha-uploading-list">
      {#each tasks as task (task.id)}
        <div class="picha-task-item">
          <div class="picha-task-thumbnail-container">
            <img src={task.previewUrl} alt={task.file.name} class="picha-task-thumbnail" class:greyed={task.status !== 'success'} />
          </div>
          <div class="picha-task-details">
            <span class="picha-file-name" title={task.file.name}>{task.file.name}</span>
            <span class="picha-file-size">{formatSize(task.file.size)}</span>
            
            {#if task.status !== 'success' && task.status !== 'error'}
              <div class="picha-progress-container">
                <div class="picha-progress-bar">
                  <div class="picha-progress-fill" style="width: {task.progress}%"></div>
                </div>
                <span class="picha-progress-percent">{task.progress}%</span>
              </div>
            {/if}

            {#if task.error}
              <p class="picha-error-text">{task.error}</p>
            {/if}
          </div>

          <div class="picha-task-right">
            {#if allowDeletion}
              <button
                type="button"
                on:click|stopPropagation={() => task.response?.id ? handleDelete(task.id, task.response.id) : tasks = tasks.filter(t => t.id !== task.id)}
                class="picha-delete-btn"
                title="Remove file"
                disabled={task.status === 'deleting'}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg
                >
              </button>
            {/if}
          </div>
        </div>
      {/each}

      {#if multiple && tasks.length > 0}
        <button type="button" class="picha-remove-all-btn" on:click={handleRemoveAll}>
          Remove all files
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .picha-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-family: inherit;
    width: 100%;
  }
  .picha-upload-zone {
    border: 1px dashed #e4e4e7;
    border-radius: 0.75rem;
    padding: 2.5rem 2rem;
    transition: all 0.2s ease;
    background: #fafafa;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .picha-upload-zone:hover {
    border-color: #a1a1aa;
  }
  .picha-upload-zone.is-dragging {
    border-color: #3b82f6;
    background: #eff6ff;
  }
  .picha-upload-circle {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.75rem;
  }
  .picha-upload-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #71717a;
    display: block;
  }
  .picha-upload-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: #09090b;
    margin: 0 0 0.25rem 0;
  }
  .picha-upload-description {
    font-size: 0.75rem;
    color: #71717a;
    margin: 0;
    text-align: center;
  }
  .picha-upload-link {
    color: #00a3ff;
    text-decoration: underline;
    cursor: pointer;
    font-weight: 600;
  }
  .picha-upload-remove-current {
    font-size: 0.75rem;
    color: #ef4444;
    text-decoration: underline;
    cursor: pointer;
    margin-top: 0.5rem;
    background: none;
    border: none;
    padding: 0;
  }

  .picha-uploading-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .picha-task-item {
    background: #ffffff;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #e4e4e7;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    position: relative;
  }
  .picha-task-thumbnail-container {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.375rem;
    overflow: hidden;
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .picha-task-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: all 0.2s ease;
  }
  .picha-task-thumbnail.greyed {
    filter: grayscale(100%);
    opacity: 0.5;
  }
  .picha-task-details {
    flex-grow: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .picha-file-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #09090b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .picha-file-size {
    font-size: 0.75rem;
    color: #71717a;
  }
  .picha-progress-container {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .picha-progress-bar {
    flex-grow: 1;
    background: #e4e4e7;
    height: 0.25rem;
    border-radius: 999px;
    overflow: hidden;
  }
  .picha-progress-fill {
    background: #09090b;
    height: 100%;
    transition: width 0.1s ease;
  }
  .picha-progress-percent {
    font-size: 0.75rem;
    color: #71717a;
    flex-shrink: 0;
  }

  .picha-delete-btn {
    background: none;
    border: none;
    color: #71717a;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .picha-delete-btn:hover:not(:disabled) {
    color: #ef4444;
    background: #f4f4f5;
  }
  .picha-delete-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .picha-remove-all-btn {
    align-self: flex-start;
    background: none;
    border: 1px solid #e4e4e7;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 0.375rem;
    color: #09090b;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 0.5rem;
  }
  .picha-remove-all-btn:hover {
    background: #f4f4f5;
  }

  .picha-error-text {
    margin: 0;
    font-size: 0.75rem;
    color: #ef4444;
  }

  @media (prefers-color-scheme: dark) {
    .picha-upload-zone {
      background: #0c0c0e;
      border-color: #27272a;
    }
    .picha-upload-zone:hover {
      border-color: #71717a;
    }
    .picha-upload-circle {
      background: #18181b;
      border-color: #27272a;
    }
    .picha-upload-icon {
      color: #a1a1aa;
    }
    .picha-upload-title {
      color: #ffffff;
    }
    .picha-upload-description {
      color: #a1a1aa;
    }
    .picha-task-item {
      background: #0f0f11;
      border-color: #27272a;
    }
    .picha-task-thumbnail-container {
      background: #18181b;
      border-color: #27272a;
    }
    .picha-file-name {
      color: #ffffff;
    }
    .picha-file-size {
      color: #a1a1aa;
    }
    .picha-progress-bar {
      background: #27272a;
    }
    .picha-progress-fill {
      background: #ffffff;
    }
    .picha-progress-percent {
      color: #a1a1aa;
    }
    .picha-delete-btn {
      color: #a1a1aa;
    }
    .picha-delete-btn:hover:not(:disabled) {
      background: #18181b;
    }
    .picha-remove-all-btn {
      border-color: #27272a;
      color: #ffffff;
    }
    .picha-remove-all-btn:hover {
      background: #18181b;
    }
  }
</style>
