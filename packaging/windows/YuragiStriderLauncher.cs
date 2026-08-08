using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class YuragiStriderLauncher
{
    [STAThread]
    private static int Main()
    {
        var applicationDirectory = AppDomain.CurrentDomain.BaseDirectory;
        var backendPath = Path.Combine(applicationDirectory, "YuragiStriderBackend.exe");

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
                "Yuragi-Strider could not start.\n\n" + exception.Message,
                "Yuragi-Strider",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return 1;
        }
    }
}
