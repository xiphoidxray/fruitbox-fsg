#!/usr/bin/env bash

nix-shell --run "
  ./deploy.sh &
  ngrok http --domain valid-adequate-marmoset.ngrok-free.app 3123
"
