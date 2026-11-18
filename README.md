# 汝职麻辣电线

校内米线点单与配送项目。当前交付是三端可交互原型，不连接真实订单、支付或微信云开发。

- [MVP 需求文档](MVP需求文档.md)
- [现行三端原型与演示说明](mixian/prototype/README.md)
- 根目录的 `index.html` 是早期原型；`mixian/miniprogram/` 和 `mixian/cloudfunctions/` 是旧小程序工程，仅供参考。

## 本地演示

在仓库根目录运行：

```sh
python3 -m http.server 8792 --bind 127.0.0.1 --directory mixian/prototype
```

| 入口 | 本地链接 |
| --- | --- |
| 点餐 | [首页](http://127.0.0.1:8792/) |
| 商家 | [商家工作台](http://127.0.0.1:8792/merchant.html) |
| 骑手 | [骑手工作台](http://127.0.0.1:8792/rider.html) |

同一浏览器、同一站点的三个入口共享演示数据；请勿填写真实个人资料或上传真实收款码。公网预览只需部署 `mixian/prototype/` 的静态页面和资源，不上传旧云函数、微信小程序配置或项目文档。
