using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class QuantaScopeLauncher
{
    [STAThread]
    private static int Main()
    {
        var applicationDirectory = AppDomain.CurrentDomain.BaseDirectory;
        var backendPath = Path.Combine(applicationDirectory, "QuantaScopeBackend.exe");

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = backendPath,
                WorkingDirectory = applicationDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            });
            return 0;
        }
        catch (Exception exception)
        {
            MessageBox.Show(
                "QuantaScope could not start.\n\n" + exception.Message,
                "QuantaScope",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return 1;
        }
    }
}
