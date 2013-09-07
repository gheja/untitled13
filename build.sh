#!/bin/bash -e

[ -d build ] || mkdir -p -m 700 build
[ -d build/compiler ] || mkdir -p -m 700 build/compiler
[ -d build/js13kgames_entry ] || mkdir -p -m 700 build/js13kgames_entry

which java 2>/dev/null >/dev/null
if [ $? != 0 ]; then
	echo "\"java\" not found in PATH, probably is not installed."
	exit 1
fi

which zip 2>/dev/null >/dev/null
if [ $? != 0 ]; then
	echo "\"zip\" not found in PATH, probably is not installed."
	exit 1
fi

if [ ! -e build/compiler/compiler.jar ]; then
	cd build/compiler
	
	if [ ! -e compiler-latest.zip ]; then
		wget http://closure-compiler.googlecode.com/files/compiler-latest.zip
	fi
	
	unzip compiler-latest.zip
	
	cd ../..
fi

rm build/js13kgames_entry/* || /bin/true

java -jar build/compiler/compiler.jar \
	--compilation_level ADVANCED_OPTIMIZATIONS \
	--use_types_for_optimization \
	--js src/13312.js \
	--js_output_file build/js13kgames_entry/13312.js

cp -xar src/index.html build/js13kgames_entry/

cd build

rm 13312.zip || /bin/true
zip 13312.zip -r js13kgames_entry

cd ..

du -b ./src ./build/js13kgames_entry ./build/13312.zip
