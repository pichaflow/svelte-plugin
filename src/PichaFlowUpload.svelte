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
  export let allowDeletion: boolean = false;

  const dispatch = createEventDispatcher();
  let isDragging = false;

  type UploadTask = {
    id: string;
    file: File;
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

    const previewTasks: UploadTask[] = imageFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: "pending" as const,
    }));

    tasks = [...tasks, ...previewTasks];

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

  function onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length) {
      handleFiles(input.files);
    }
    input.value = ""; // Reset input
  }
</script>

<div
  class="picha-upload-zone"
  class:is-dragging={isDragging}
  on:dragover|preventDefault={() => (isDragging = true)}
  on:dragleave|preventDefault={() => (isDragging = false)}
  on:drop|preventDefault={onDrop}
>
  {#if tasks.length === 0}
    <div class="picha-upload-content">
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
      <p class="picha-upload-text">
        Drag & drop or <label class="picha-upload-link"
          >browse<input
            type="file"
            accept="image/*"
            multiple
            on:change={onFileSelect}
            hidden
          /></label
        >
      </p>
    </div>
  {:else}
    <div class="picha-uploading-list">
      {#each tasks as task (task.id)}
        <div class="picha-task-item">
          <div class="picha-task-info">
            <span class="picha-file-name">{task.file.name}</span>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="picha-status-text {task.status}">
                {#if task.status === "success"}
                  Uploaded
                {:else if task.status === "error"}
                  Failed
                {:else if task.status === "deleting"}
                  Deleting...
                {:else}
                  {task.progress}%
                {/if}
              </span>
              {#if allowDeletion && (task.status === "success" || task.status === "deleting") && task.response?.id}
                <button
                  on:click={() =>
                    handleDelete(task.id, task.response?.id || "")}
                  class="picha-delete-btn"
                  title="Delete asset"
                  disabled={task.status === "deleting"}
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
                    ><polyline points="3 6 5 6 21 6"></polyline><path
                      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    ></path><line x1="10" y1="11" x2="10" y2="17"></line><line
                      x1="14"
                      y1="11"
                      x2="14"
                      y2="17"
                    ></line></svg
                  >
                </button>
              {/if}
            </div>
          </div>
          <div class="picha-progress-bar">
            <div
              class="picha-progress-fill {task.status}"
              style="width: {task.progress}%"
            ></div>
          </div>
          {#if task.error}
            <p class="picha-error-text">{task.error}</p>
          {/if}
        </div>
      {/each}

      <div class="picha-add-more">
        <p class="picha-upload-text">
          <label class="picha-upload-link"
            >Upload more files<input
              type="file"
              accept="image/*"
              multiple
              on:change={onFileSelect}
              hidden
            /></label
          >
        </p>
      </div>
    </div>
  {/if}
</div>

<style>
  .picha-upload-zone {
    border: 2px dashed #e2e8f0;
    border-radius: 0.75rem;
    padding: 2rem;
    transition: all 0.2s ease;
    background: #f8fafc;
  }
  .picha-upload-zone.is-dragging {
    border-color: #3b82f6;
    background: #eff6ff;
  }
  .picha-upload-content {
    text-align: center;
  }
  .picha-upload-icon {
    width: 2rem;
    height: 2rem;
    color: #94a3b8;
    margin: 0 auto 1rem;
    display: block;
  }
  .picha-upload-text {
    color: #64748b;
    font-size: 0.875rem;
    margin: 0;
  }
  .picha-upload-link {
    color: #3b82f6;
    font-weight: 600;
    cursor: pointer;
  }

  .picha-uploading-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .picha-task-item {
    background: white;
    padding: 1rem;
    border-radius: 0.5rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    border: 1px solid #f1f5f9;
  }
  .picha-task-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .picha-file-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #334155;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 70%;
  }
  .picha-status-text {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
  }
  .picha-status-text.success {
    color: #10b981;
  }
  .picha-status-text.error {
    color: #ef4444;
  }
  .picha-status-text.deleting {
    color: #f59e0b;
  }

  .picha-delete-btn {
    background: none;
    border: none;
    color: #94a3b8;
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
    background: #fef2f2;
  }
  .picha-delete-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .picha-progress-bar {
    background: #e2e8f0;
    height: 0.5rem;
    border-radius: 999px;
    overflow: hidden;
  }
  .picha-progress-fill {
    background: #3b82f6;
    height: 100%;
    transition: width 0.1s ease;
  }
  .picha-progress-fill.success {
    background: #10b981;
  }
  .picha-progress-fill.error {
    background: #ef4444;
  }

  .picha-error-text {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: #ef4444;
  }
  .picha-add-more {
    text-align: center;
    margin-top: 1.5rem;
  }

  @media (prefers-color-scheme: dark) {
    .picha-upload-zone {
      background: #0f172a;
      border-color: #1e293b;
    }
    .picha-task-item {
      background: #1e293b;
      border-color: #334155;
    }
    .picha-file-name {
      color: #f8fafc;
    }
    .picha-progress-bar {
      background: #334155;
    }
  }
</style>
