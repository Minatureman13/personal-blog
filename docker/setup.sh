#!/bin/bash

if ! [ -x "$(command -v docker-compose)" ]; then
  echo 'Error: docker-compose is not installed.' >&2
  exit 1
fi

if [ -d "$data_path" ]; then
  read -p "Did you update the dump file reference in the mysql dockerfile? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

read -p "Enter URL where app will be running from. Ex: 'canopytentreviews.com': " url
echo "### Setting up application to run at "$url
echo "URL="$url > .env

echo "### Starting db ..."
docker-compose up -d db

echo "### Starting app ..."
docker-compose up -d app

echo "### Running init-letsencrypt ..."
chmod a+x ./reverse-proxy/init-letsencrypt.sh

./reverse-proxy/init-letsencrypt.sh $url

echo "### Starting nginx and certbot ..."
docker-compose up -d