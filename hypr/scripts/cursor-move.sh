#!/bin/bash

dx=0
dy=0

[[ "$1" == "up" ]]    && dy=-30
[[ "$1" == "down" ]]  && dy=30
[[ "$1" == "left" ]]  && dx=-30
[[ "$1" == "right" ]] && dx=30

wlrctl pointer move $dx $dy
