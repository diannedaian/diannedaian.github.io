// drawing.js
let currentBrush = 'pen';
let hasDrawn = false;
let theCanvas;

// UI wiring
(function initControls(){
  const controls = document.getElementById('drawingControls');
  controls.addEventListener('click', (e) => {
    const btn = e.target.closest('.drawing-btn');
    if (!btn) return;
    if (btn.id === 'saveImg') { saveCanvasPNG(); return; }
    const brush = btn.dataset.brush;
    if (!brush) return;
    currentBrush = brush;
    [...controls.querySelectorAll('.drawing-btn')].forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  });

  document.getElementById('clearCanvas').addEventListener('click', () => {
    clearCanvas();
  });
})();

// ...rest of p5.js setup/draw/brushes...
