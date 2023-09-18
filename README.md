# sourcerer


## Setup

```sh
# (once)
yarn && yarn prepack
sudo ln -s $PWD/bin/sourcerer /usr/local/bin

# (every time)
sourcerer
```

## Development

```sh
yarn format # runs prettier
yarn start # builds and runs using node directly
yarn prepack # builds and packages an executable into bin/sourcerer
```