#!/bin/bash

try()
{
	$@
	
	result=$?
	if [ $result != 0 ]; then
		echo "\"$@\" failed with exit code $result."
		exit 1
	fi
}

[ -d build ] || try mkdir -p -m 700 build
[ -d build/compiler ] || try mkdir -p -m 700 build/compiler
[ -d build/js13kgames_entry ] || try mkdir -p -m 700 build/js13kgames_entry

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
	echo "* Closure Compiler not found."
	
	try cd build/compiler
	
	if [ ! -e compiler-latest.zip ]; then
		echo "* Downloading Closure Compiler..."
		try wget http://closure-compiler.googlecode.com/files/compiler-latest.zip
	fi
	
	echo "* Unzipping Closure Compiler... "
	try unzip compiler-latest.zip
	
	try cd ../..
fi
echo "* Closure Compiler seems to be good."

echo "* Cleaning up build directory..."
rm build/js13kgames_entry/* || /bin/true

echo "* Copying resources..."
try cp -xarv src/* build/js13kgames_entry/

echo "* Removing debug parts and renaming some variables..."
cat build/js13kgames_entry/13312.js | sed \
	-e '/DEBUG BEGIN/,/\DEBUG END/{d}' \
	-e 's/.*[A-Z].log.*//g' \
	-e 's/\.direction/.d/g' \
	-e 's/\.position/.p/g' \
	-e 's/\.speed/.s/g' > build/js13kgames_entry/13312.js.1
mv build/js13kgames_entry/13312.js.1 build/js13kgames_entry/13312.js

echo "* Running Closure Compiler..."
try java -jar build/compiler/compiler.jar \
	--compilation_level ADVANCED_OPTIMIZATIONS \
	--use_types_for_optimization \
	--js build/js13kgames_entry/13312.js \
	--js_output_file build/js13kgames_entry/13312.min.js

try mv -f build/js13kgames_entry/13312.min.js build/js13kgames_entry/13312.js

echo "* Optimizing index.html..."
cat build/js13kgames_entry/index.html | tr '\n' ' ' | sed -r 's/\s+/ /g' | sed -e 's/> </></g' > build/js13kgames_entry/index.html.1
mv build/js13kgames_entry/index.html.1 build/js13kgames_entry/index.html

try cd build

now=`date +%Y%m%d_%H%M%S`
git_id=`git log -1 --format="%H"`
zip_file="13312_${now}_${git_id}.zip"

echo "* Creating new archive $zip_file ..."
try zip $zip_file -r js13kgames_entry

try cd ..

echo "Done."

du -b ./src ./build/js13kgames_entry ./build/$zip_file
