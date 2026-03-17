<script lang="ts">
  interface Props {
    onResize: (deltaX: number) => void
  }

  const { onResize }: Props = $props()

  let dragging = $state(false)
  let startX = 0

  function handlePointerDown(event: PointerEvent): void {
    dragging = true
    startX = event.clientX
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!dragging) return
    const delta = event.clientX - startX
    startX = event.clientX
    onResize(delta)
  }

  function handlePointerUp(): void {
    dragging = false
  }
</script>

<div
  class="resize-handle"
  class:resize-handle--dragging={dragging}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  role="separator"
  aria-orientation="vertical"
></div>

<style>
  .resize-handle {
    width: 4px;
    cursor: col-resize;
    background-color: transparent;
    transition: background-color 0.15s;
    flex-shrink: 0;
  }

  .resize-handle:hover,
  .resize-handle--dragging {
    background-color: var(--accent-primary);
  }
</style>
