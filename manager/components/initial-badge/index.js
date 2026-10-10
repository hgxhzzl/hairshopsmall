Component({
  properties: {
    value: { type: String, value: '' },
    fallback: { type: String, value: '会' },
    size: { type: String, value: 'md' },
    gender: { type: String, value: '' }
  },

  computed: {},

  lifetimes: {
    attached() {
      this.updateDisplay();
    }
  },

  observers: {
    'value, fallback, size, gender'() {
      this.updateDisplay();
    }
  },

  methods: {
    updateDisplay() {
      const normalizedValue = (this.properties.value || '').trim();
      const initial = normalizedValue ? Array.from(normalizedValue)[0] : this.properties.fallback;
      const size = this.properties.size || 'md';
      const gender = this.properties.gender || '';

      let genderClass = '';
      if (gender === '男') genderClass = 'initial-badge-male';
      else if (gender === '女') genderClass = 'initial-badge-female';

      this.setData({
        initial,
        sizeClass: 'initial-badge-' + size,
        textSizeClass: 'initial-badge-text-' + size,
        genderClass
      });
    }
  }
});
