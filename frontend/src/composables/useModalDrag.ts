/**
 * 弹窗拖拽：按住弹窗头部即可拖动整个弹窗。
 * 通过模板事件绑定，元素为 v-if 动态创建也能直接使用：
 *   @pointerdown="drag.onDown($event, modalEl)"
 *   @pointermove="drag.onMove($event, modalEl)"
 *   @pointerup="drag.onUp"
 *   @pointercancel="drag.onUp"
 */
export function useModalDrag() {
  let dragging = false
  let sx = 0
  let sy = 0
  let ox = 0
  let oy = 0

  function onDown(e: PointerEvent, modal: HTMLElement | null) {
    if (!modal) return
    // 移动端/H5 不做拖拽（触摸、窄屏、粗指针设备均跳过）
    if (e.pointerType !== 'mouse') return
    if (window.innerWidth <= 768) return
    const t = e.target as HTMLElement
    // 点击按钮/输入框等交互元素时不触发拖拽
    if (t.closest('button, input, a, select, textarea, [role="button"]')) return
    const r = modal.getBoundingClientRect()
    // 从 flex 居中态转为显式定位，再跟随指针移动
    modal.style.position = 'fixed'
    modal.style.left = `${r.left}px`
    modal.style.top = `${r.top}px`
    modal.style.margin = '0'
    modal.style.maxWidth = 'none'
    sx = e.clientX
    sy = e.clientY
    ox = r.left
    oy = r.top
    dragging = true
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  function onMove(e: PointerEvent, modal: HTMLElement | null) {
    if (!dragging || !modal) return
    modal.style.left = `${ox + (e.clientX - sx)}px`
    modal.style.top = `${oy + (e.clientY - sy)}px`
  }

  function onUp() {
    dragging = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  return { onDown, onMove, onUp }
}
