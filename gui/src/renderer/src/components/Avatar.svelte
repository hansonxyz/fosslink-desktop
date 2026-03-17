<script lang="ts">
  interface Props {
    initials: string
    color: string
    size?: number
    photo?: string | null
  }

  const { initials, color, size = 40, photo = null }: Props = $props()
</script>

<div
  class="avatar"
  style:width="{size}px"
  style:height="{size}px"
  style:background-color={photo ? 'transparent' : color}
  style:font-size="{size * 0.4}px"
>
  {#if photo}
    <img
      src={photo}
      alt={initials}
      class="avatar__photo"
      width={size}
      height={size}
    />
  {:else}
    {initials}
  {/if}
</div>

<style>
  .avatar {
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: var(--font-weight-semibold);
    flex-shrink: 0;
    user-select: none;
    overflow: hidden;
  }

  .avatar__photo {
    border-radius: var(--radius-full);
    object-fit: cover;
  }
</style>
