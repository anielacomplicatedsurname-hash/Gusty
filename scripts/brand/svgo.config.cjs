module.exports = { multipass: true, floatPrecision: 1, plugins: [
  { name: 'preset-default' }, 'removeDimensions',
  { name: 'removeAttrs', params: { attrs: ['fill', 'stroke'] } },
  { name: 'addAttributesToSVGElement', params: { attributes: [{ fill: 'currentColor' }] } },
]};
