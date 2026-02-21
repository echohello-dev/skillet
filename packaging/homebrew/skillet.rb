class Skillet < Formula
  desc "Portable CLI for managing agent skills"
  homepage "https://github.com/echohello-dev/skillet"
  version "0.0.0"

  on_arm do
    url "https://github.com/echohello-dev/skillet/releases/download/v0.0.0/skillet-darwin-arm64"
    sha256 "6942db0202df2fa04c2f6a2a17ce62930d7045bb7cc775a8dd3aff33125fac5c"
  end

  on_intel do
    url "https://github.com/echohello-dev/skillet/releases/download/v0.0.0/skillet-darwin-x64"
    sha256 "9105b2738cac79fb96d45694d62946d20cf819838dd3448ebdbcfb5243e1c6e1"
  end

  def install
    artifact = Hardware::CPU.arm? ? "skillet-darwin-arm64" : "skillet-darwin-x64"
    bin.install artifact => "skillet"
  end

  test do
    assert_match "skillet/", shell_output("#{bin}/skillet --version")
  end
end
