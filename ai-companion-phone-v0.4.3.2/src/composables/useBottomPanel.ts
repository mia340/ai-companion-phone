import { computed, ref, watch, type Ref } from 'vue'

export function useBottomPanel<Panel extends string>(activePanel: Ref<Panel | null>) {
  const panelDragOffset = ref(0)
  const isPanelDragging = ref(false)
  let panelDragStartY = 0

  const panelStyle = computed(() => ({
    transform: `translate3d(0, ${panelDragOffset.value}px, 0)`,
    transition: isPanelDragging.value ? 'none' : undefined
  }))

  function beginPanelDrag(event: PointerEvent) {
    panelDragStartY = event.clientY
    panelDragOffset.value = 0
    isPanelDragging.value = true
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  function movePanelDrag(event: PointerEvent) {
    if (!isPanelDragging.value) return
    panelDragOffset.value = Math.max(0, event.clientY - panelDragStartY)
  }

  function endPanelDrag() {
    if (!isPanelDragging.value) return
    isPanelDragging.value = false
    if (panelDragOffset.value > 92) activePanel.value = null
    panelDragOffset.value = 0
  }

  watch(activePanel, () => {
    panelDragOffset.value = 0
    isPanelDragging.value = false
  })

  return { panelStyle, beginPanelDrag, movePanelDrag, endPanelDrag }
}
