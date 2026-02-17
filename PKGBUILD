# Maintainer: IamAndelib <andelibtarefsrizon@gmail.com>

_pkgname=tessera
pkgname=kwin-scripts-tessera
pkgver=1.2.0
pkgrel=1
pkgdesc='Hyprland-style dwindle tiling for KDE Plasma 6'
arch=('any')
url='https://github.com/IamAndelib/Tessera'
license=('MIT')

depends=('kwin')
makedepends=('npm' 'zip')

source=("$_pkgname-$pkgver.tar.gz::https://github.com/IamAndelib/Tessera/archive/refs/tags/v$pkgver.tar.gz")
sha256sums=('SKIP')

build() {
    cd "Tessera-$pkgver"
    [[ -d pkg ]] && make clean
    make src res
}

package() {
    cd "Tessera-$pkgver"
    install -dm755 "$pkgdir/usr/share/kwin/scripts/$_pkgname"
    cp -r pkg/* "$pkgdir/usr/share/kwin/scripts/$_pkgname/"

    install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
}
