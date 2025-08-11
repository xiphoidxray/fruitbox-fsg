{ pkgs ? import <nixpkgs> { config.allowUnfree = true; } }:

pkgs.mkShell {
  buildInputs = [
    pkgs.bun
    pkgs.ngrok
  ];
}
