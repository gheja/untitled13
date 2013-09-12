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
[ -d build/client ] || try mkdir -p -m 700 build/client
[ -d build/server ] || try mkdir -p -m 700 build/server
[ -d build/all ] || try mkdir -p -m 700 build/all

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

echo "* Cleaning up build directories..."
rm build/client/* || /bin/true
rm build/server/* || /bin/true
rm build/all/* || /bin/true

echo "* Client"

echo "  * Removing debug parts and renaming some variables..."
cat src/13312.js | sed \
	-e '/DEBUG BEGIN/,/\DEBUG END/{d}' \
	-e 's/.*[A-Z].log.*//g' \
	-e 's/\.direction/.d/g' \
	-e 's/\.position/.p/g' \
	-e 's/\.speed/.s/g' > build/client/13312.js

echo "  * Running Closure Compiler..."
try java -jar build/compiler/compiler.jar \
	--compilation_level ADVANCED_OPTIMIZATIONS \
	--use_types_for_optimization \
	--externs src/externs.js \
	--js build/client/13312.js \
	--js_output_file build/client/13312.min.js

try mv -f build/client/13312.min.js build/client/13312.js

echo "  * Embedding js into index.html..."
{
	cat src/index.html | while read line; do
		echo "$line" | grep -Eq 'src=\"13312.js\"'
		if [ $? == 0 ]; then
			echo "<script>";
			cat build/client/13312.js
			echo "</script>"
		else
			echo "$line"
		fi
	done
} > build/client/index.html

echo "  * Optimizing index.html..."
cat build/client/index.html | tr '\n' ' ' | sed -r 's/\s+/ /g' | sed -e 's/> </></g' > build/client/index.html.1
try mv -v build/client/index.html.1 build/client/index.html
try rm -v build/client/13312.js

echo "* Server"

echo "  * Removing debug parts and renaming some variables..."
cat src/server.js | sed \
	-e '/DEBUG BEGIN/,/\DEBUG END/{d}' \
	-e 's/.*[A-Z].log.*//g' > build/server/server.js

echo "  * Running Closure Compiler..."
try java -jar build/compiler/compiler.jar \
	--compilation_level ADVANCED_OPTIMIZATIONS \
	--use_types_for_optimization \
	--js build/server/server.js \
	--js_output_file build/server/server.min.js

try mv -f build/server/server.min.js build/server/server.js

echo "* All"

echo "  * Copying files..."
cp -xarv build/client/* build/server/* build/all/

try cd build

now=`date +%Y%m%d_%H%M%S`
git_id=`git log -1 --format="%H"`
zip_file="13312_${now}_${git_id}"

echo "* Creating new archive ${zip_file}_client.zip ..."
try zip ${zip_file}_client.zip -r client

echo "* Creating new archive ${zip_file}_server.zip ..."
try zip ${zip_file}_server.zip -r server

echo "* Creating new archive ${zip_file}_all.zip ..."
try zip ${zip_file}_all.zip -r all

try cd ..

echo "Done."

du -b ./src ./build/client ./build/server ./build/all ./build/${zip_file}_client.zip ./build/${zip_file}_server.zip ./build/${zip_file}_all.zip
