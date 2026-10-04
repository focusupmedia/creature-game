import Capacitor

/// The app's web view. Registers our own plugins (npm plugins register themselves).
class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CloudSavePlugin())
    }
}
