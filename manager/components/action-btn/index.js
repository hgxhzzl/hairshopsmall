Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    type: { type: String, value: 'edit' },
    iconSize: { type: Number, value: 26 },
    fontSize: { type: Number, value: 26 },
    fontWeight: { type: String, value: '500' },
    customStyle: { type: String, value: '' },
    disabled: { type: Boolean, value: false }
  },

  data: {
    icon: 'edit',
    label: '修改',
    theme: 'myedit',
    btnColor: '#245c98',
    useAppIcon: false,
    appIconName: '',
    iconColor: ''
  },

  observers: {
    type(type) {
      const map = {
        edit:     { icon: 'edit',       label: '修改', theme: 'myedit',    btnColor: '#2477d0ff', useAppIcon: false },
        delete:   { icon: 'delete',     label: '删除', theme: 'mydanger',  btnColor: '#ec5d53ff', useAppIcon: false },
        detail:   { icon: 'browse',     label: '详情', theme: 'mysuccess', btnColor: '#2ba471', useAppIcon: false },
        select:   { icon: 'check',      label: '选择', theme: 'myedit',    btnColor: '#206ec2ff', useAppIcon: false },
        recharge: { label: '充值', theme: 'success',  btnColor: '#2ba471', useAppIcon: true, appIconName: 'recharge',     iconColor: '#2ba471' },
        consume:  { label: '消费', theme: 'warning',  btnColor: '#e37318', useAppIcon: true, appIconName: 'consumption',  iconColor: '#e37318' },
      };
      const cfg = map[type] || map.edit;
      this.setData({
        icon: cfg.icon || '',
        label: cfg.label,
        theme: cfg.theme,
        btnColor: cfg.btnColor || '',
        useAppIcon: cfg.useAppIcon || false,
        appIconName: cfg.appIconName || '',
        iconColor: cfg.iconColor || ''
      });
    }
  },

  methods: {
    onTap() {
      if (this.data.disabled) return;
      this.triggerEvent('tap');
    }
  }
});
