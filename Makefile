NAME = $(shell npm pkg get name | tr -d '"')
VERSION = $(shell npm pkg get version | tr -d '"')

PKGFILE = $(NAME).kwinscript
PKGDIR = pkg

.NOTPARALLEL: all

all: build install cleanall

build: res src
	zip -r $(PKGFILE) $(PKGDIR)

$(PKGFILE): build

install: $(PKGFILE)
	kpackagetool6 -t KWin/Script -s $(NAME) \
		&& kpackagetool6 -t KWin/Script -u $(PKGFILE) \
		|| kpackagetool6 -t KWin/Script -i $(PKGFILE)

uninstall:
	kpackagetool6 -t KWin/Script -r $(NAME)

clean: $(PKGDIR)
	rm -r $(PKGDIR)

cleanpkg: $(PKGFILE)
	rm $(PKGFILE)

cleanall: clean cleanpkg

start: stop
	dbus-send --session --dest=org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript string:'' string:'$(NAME)'

stop:
	dbus-send --session --dest=org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript string:'$(NAME)'

lint:
	npx eslint "src/**"

res: $(PKGDIR)
	cp -f res/metadata.json $(PKGDIR)/
	cp -f res/main.xml $(PKGDIR)/contents/config/
	cp -f res/config.ui $(PKGDIR)/contents/ui/
	cp -f res/main.js $(PKGDIR)/contents/code/
	sed -i "s/%VERSION%/$(VERSION)/" $(PKGDIR)/metadata.json
	sed -i "s/%NAME%/$(NAME)/" $(PKGDIR)/metadata.json

src: tessera.mjs $(PKGDIR)
	mv -f tessera.mjs $(PKGDIR)/contents/code/main.mjs
	cp -f src/qml/* $(PKGDIR)/contents/ui/

tessera.mjs:
	npm install
	npx esbuild --bundle src/index.ts --outfile=tessera.mjs --format=esm --platform=neutral --target=es2020

$(PKGDIR):
	mkdir -p $(PKGDIR)
	mkdir -p $(PKGDIR)/contents/code
	mkdir $(PKGDIR)/contents/config
	mkdir $(PKGDIR)/contents/ui
