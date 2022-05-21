# ArcaLink

Arcaea Link Play 功能的一个实现。

## 使用方式

```sh
$ git clone https://github.com/tiger0132/ArcaLink.git
$ cd ArcaLink
$ pnpm install
$ cp src/config.example.ts src/config.ts
$ sed -i "s/key: ''/key: '$(dd if=/dev/urandom | base64 -w0 | dd bs=1 count=32 2>/dev/null)'/g" src/config.ts # 随机生成一个 key
$ pnpm build
$ pnpm start
```