/**
 * AppIcon 自定义图标组件
 * 参考 HairShopWeb/src/components/icons/AppIcon.tsx 的 SVG 路径
 * 通过 data:image/svg+xml 数据 URI 渲染，支持动态颜色
 */

var ICON_PATHS = {
  home: '<path d="M9 18V42H39V18L24 6L9 18Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 29V42H29V29H19Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M9 42H39" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
  member: '<path d="M4.50326 16.3661L12.5158 7.67177C12.909 7.2452 13.4807 7 14.0821 7H33.9179C34.5193 7 35.091 7.2452 35.4842 7.67177L43.4967 16.3661C44.1809 17.1084 44.1659 18.2125 43.4618 18.9383L24.7499 40.1499C24.3518 40.6012 23.6482 40.6012 23.2501 40.1499L4.5382 18.9383C3.83415 18.2125 3.81915 17.1084 4.50326 16.3661Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 20L24 29L32 20" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  recharge: '<path d="M15.0002 14.3848C19.1256 16.0002 24.0085 16.0002 24.0085 16.0002C24.0085 16.0002 28.8802 16.0002 33.0002 14.3848C37.502 19.6386 40.6566 26.5646 42.7299 32.3977C44.8289 38.3029 40.2008 44.0002 33.9336 44.0002H14.0199C7.76837 44.0002 3.14607 38.329 5.23448 32.4366C7.29812 26.614 10.455 19.6856 15.0002 14.3848Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M18 28H30" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 34H30" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24.0088 28V38" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 22L24 28L18 22" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 16C31.1797 16 37 13.3137 37 10C37 6.68629 31.1797 4 24 4C16.8203 4 11 6.68629 11 10C11 13.3137 16.8203 16 24 16Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  consumption: '<path d="M17 7H16H10C8.89543 7 8 7.89543 8 9L8 42C8 43.1046 8.89543 44 10 44H38C39.1046 44 40 43.1046 40 42V9C40 7.89543 39.1046 7 38 7H33.0499H31" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="17" y="4" width="14" height="6" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>',
  me: '<path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 23C26.7614 23 29 20.7614 29 18C29 15.2386 26.7614 13 24 13C21.2386 13 19 15.2386 19 18C19 20.7614 21.2386 23 24 23Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M10.022 38.332C10.3657 33.1206 14.7016 29 20 29H28C33.2914 29 37.6229 33.1097 37.9767 38.3113" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
};

function buildSvgSrc(name, color) {
  var paths = ICON_PATHS[name];
  if (!paths) return '';
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">' + paths + '</svg>';
  // 替换 currentColor 为实际颜色
  svg = svg.split('currentColor').join(color);
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

Component({
  properties: {
    name: { type: String, value: '' },
    size: { type: String, value: '52rpx' },
    color: { type: String, value: '#999999' }
  },

  data: {
    src: ''
  },

  observers: {
    'name, color': function () {
      this.updateSrc();
    }
  },

  lifetimes: {
    attached() {
      this.updateSrc();
    }
  },

  methods: {
    updateSrc() {
      var src = buildSvgSrc(this.data.name, this.data.color);
      this.setData({ src: src });
    }
  }
});
