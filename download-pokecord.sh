#!/bin/bash

directory="data/pokecord/$1"

mkdir -p "$directory"
wget "$2" -O "$directory/pokecord.png"
