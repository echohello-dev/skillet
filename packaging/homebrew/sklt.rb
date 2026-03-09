class Sklt < Formula
  desc "Portable CLI for managing agent skills"
  homepage "https://github.com/echohello-dev/skillet"
  version "0.0.0"

  on_arm do
    url "https://github.com/echohello-dev/skillet/releases/download/v0.0.0/sklt-darwin-arm64"
    sha256 "58bd50e1aeb91880d968b27b540e99008ba58d190ec9fb077f29953b0c5cbbba"
  end

  on_intel do
    url "https://github.com/echohello-dev/skillet/releases/download/v0.0.0/sklt-darwin-x64"
    sha256 "ed219039a3e8dfc82658ed2ebf765d8ad352dd9f32169786c34d2bb2a2497c78"
  end

  def install
    artifact = Hardware::CPU.arm? ? "sklt-darwin-arm64" : "sklt-darwin-x64"
    bin.install artifact => "sklt"
  end

  test do
    assert_match "sklt/", shell_output("#{bin}/sklt --version")
  end
end
