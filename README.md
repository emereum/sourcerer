# sourcemap-fs


## Setup

```sh
# (once)
yarn && yarn prepack
sudo ln -s $PWD/bin/sourcemap-fs /usr/local/bin

# (every time)
sourcemap-fs
```

## Development

```sh
yarn format # runs prettier
yarn start # builds and runs using node directly
yarn prepack # builds and packages an executable into bin/sourcemap-fs
```