using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class YuragiStriderLauncher
{
    private const string ApplicationName = "Yuragi-Strider";
    private const string BackendExecutable = "YuragiStriderBackend.exe";

    private static Process backendProcess;
    private static NotifyIcon trayIcon;

    [STAThread]
    private static int Main()
    {
        var applicationDirectory = AppDomain.CurrentDomain.BaseDirectory;
        var backendPath = Path.Combine(applicationDirectory, BackendExecutable);

        if (!File.Exists(backendPath))
        {
            ShowError(
                "The Yuragi-Strider calculation backend is missing.\n\n"
                + "Extract the whole ZIP archive before starting the application, "
                + "then run " + ApplicationName + ".exe from the extracted folder."
            );
            return 1;
        }

        try
        {
            backendProcess = Process.Start(new ProcessStartInfo
            {
                FileName = backendPath,
                WorkingDirectory = applicationDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            });
        }
        catch (Exception exception)
        {
            ShowError("Yuragi-Strider could not start.\n\n" + exception.Message);
            return 1;
        }

        // The backend owns the browser tab, but nothing in the UI can stop the
        // hidden process. Without a tray entry the only way out is Task
        // Manager, so the launcher stays resident and exposes an exit command.
        Application.EnableVisualStyles();
        trayIcon = CreateTrayIcon();

        // The backend exiting on its own (a port failure, a crash) must not
        // leave an orphaned tray icon pointing at nothing.
        backendProcess.EnableRaisingEvents = true;
        backendProcess.Exited += (sender, eventArguments) => Application.Exit();

        Application.ApplicationExit += (sender, eventArguments) => ShutDownBackend();
        Application.Run();
        return 0;
    }

    private static NotifyIcon CreateTrayIcon()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Open Yuragi-Strider", null, (sender, eventArguments) => OpenBrowser());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Exit Yuragi-Strider", null, (sender, eventArguments) => Application.Exit());

        var icon = new NotifyIcon
        {
            Icon = ExtractOwnIcon(),
            Text = ApplicationName,
            ContextMenuStrip = menu,
            Visible = true,
        };
        icon.DoubleClick += (sender, eventArguments) => OpenBrowser();
        return icon;
    }

    private static System.Drawing.Icon ExtractOwnIcon()
    {
        try
        {
            return System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        }
        catch (Exception)
        {
            return System.Drawing.SystemIcons.Application;
        }
    }

    /// <summary>
    /// Reopen the UI using the address the backend actually bound to. The
    /// backend shifts to the next free port when 8765 is taken, so the log is
    /// the only reliable source for the current URL.
    /// </summary>
    private static void OpenBrowser()
    {
        var url = ReadServingUrl() ?? "http://127.0.0.1:8765/";
        try
        {
            Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
        }
        catch (Exception exception)
        {
            ShowError("The Yuragi-Strider window could not be opened.\n\n" + exception.Message);
        }
    }

    private static string ReadServingUrl()
    {
        try
        {
            var logPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                ApplicationName,
                "launcher.log"
            );
            if (!File.Exists(logPath))
            {
                return null;
            }

            // The log is still held open by the backend for writing.
            string contents;
            using (var stream = new FileStream(
                logPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            using (var reader = new StreamReader(stream))
            {
                contents = reader.ReadToEnd();
            }

            const string marker = "Serving Yuragi-Strider at ";
            var index = contents.LastIndexOf(marker, StringComparison.Ordinal);
            if (index < 0)
            {
                return null;
            }

            var start = index + marker.Length;
            var end = contents.IndexOfAny(new[] { '\r', '\n' }, start);
            var url = end < 0 ? contents.Substring(start) : contents.Substring(start, end - start);
            url = url.Trim();
            return url.StartsWith("http://", StringComparison.Ordinal) ? url : null;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static void ShutDownBackend()
    {
        if (trayIcon != null)
        {
            trayIcon.Visible = false;
            trayIcon.Dispose();
            trayIcon = null;
        }

        try
        {
            if (backendProcess != null && !backendProcess.HasExited)
            {
                backendProcess.Kill();
                backendProcess.WaitForExit(5000);
            }
        }
        catch (Exception)
        {
            // The backend already exited, or exited while being stopped.
            // Either way there is nothing left to clean up.
        }
    }

    private static void ShowError(string message)
    {
        MessageBox.Show(message, ApplicationName, MessageBoxButtons.OK, MessageBoxIcon.Error);
    }
}
