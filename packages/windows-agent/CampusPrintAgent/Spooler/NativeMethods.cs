using System.Runtime.InteropServices;

namespace CampusPrintAgent.Spooler;

public static class NativeMethods
{
    private const string WinSpool = "winspool.drv";

    #region Constants - DEVMODE Specification

    // Paper sizes
    public const short DMPAPER_A4 = 9;
    public const short DMPAPER_A3 = 8;

    // Duplex modes
    public const short DMDUP_SIMPLEX = 1;
    public const short DMDUP_VERTICAL = 2;   // Long-edge duplex
    public const short DMDUP_HORIZONTAL = 3; // Short-edge duplex

    // Color modes
    public const short DMCOLOR_MONOCHROME = 1;
    public const short DMCOLOR_COLOR = 2;

    // DEVMODE field mask flags
    public const int DM_PAPERSIZE = 0x00000002;
    public const int DM_COPIES = 0x00000100;
    public const int DM_COLOR = 0x00000800;
    public const int DM_DUPLEX = 0x00001000;

    // DocumentProperties modes
    public const int DM_IN_BUFFER = 8;
    public const int DM_OUT_BUFFER = 2;

    // Printer Status Flags
    public const uint PRINTER_STATUS_PAUSED = 0x00000001;
    public const uint PRINTER_STATUS_ERROR = 0x00000002;
    public const uint PRINTER_STATUS_PENDING_DELETION = 0x00000004;
    public const uint PRINTER_STATUS_PAPER_JAM = 0x00000008;
    public const uint PRINTER_STATUS_PAPER_OUT = 0x00000010;
    public const uint PRINTER_STATUS_MANUAL_FEED = 0x00000020;
    public const uint PRINTER_STATUS_PAPER_PROBLEM = 0x00000040;
    public const uint PRINTER_STATUS_OFFLINE = 0x00000080;
    public const uint PRINTER_STATUS_IO_ACTIVE = 0x00000100;
    public const uint PRINTER_STATUS_BUSY = 0x00000200;
    public const uint PRINTER_STATUS_PRINTING = 0x00000400;
    public const uint PRINTER_STATUS_OUTPUT_BIN_FULL = 0x00000800;
    public const uint PRINTER_STATUS_NOT_AVAILABLE = 0x00001000;
    public const uint PRINTER_STATUS_WAITING = 0x00002000;
    public const uint PRINTER_STATUS_PROCESSING = 0x00004000;
    public const uint PRINTER_STATUS_INITIALIZING = 0x00008000;
    public const uint PRINTER_STATUS_WARMING_UP = 0x00010000;
    public const uint PRINTER_STATUS_TONER_LOW = 0x00020000;
    public const uint PRINTER_STATUS_NO_TONER = 0x00040000;
    public const uint PRINTER_STATUS_PAGE_PUNT = 0x00080000;
    public const uint PRINTER_STATUS_USER_INTERVENTION = 0x00100000;
    public const uint PRINTER_STATUS_OUT_OF_MEMORY = 0x00200000;
    public const uint PRINTER_STATUS_DOOR_OPEN = 0x00400000;
    public const uint PRINTER_STATUS_SERVER_UNKNOWN = 0x00800000;
    public const uint PRINTER_STATUS_POWER_SAVE = 0x01000000;

    #endregion

    #region Structs

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct DOCINFO
    {
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string? pOutputFile;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string? pDataType;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct PRINTER_DEFAULTS
    {
        public IntPtr pDatatype;
        public IntPtr pDevMode;
        public int DesiredAccess;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct PRINTER_INFO_2
    {
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pServerName;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pPrinterName;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pShareName;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pPortName;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pDriverName;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pComment;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pLocation;
        public IntPtr pDevMode;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pSepFile;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pPrintProcessor;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pDatatype;
        [MarshalAs(UnmanagedType.LPTStr)]
        public string pParameters;
        public IntPtr pSecurityDescriptor;
        public uint Attributes;
        public uint Priority;
        public uint DefaultPriority;
        public uint StartTime;
        public uint UntilTime;
        public uint Status;
        public uint cJobs;
        public uint AveragePPM;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct DEVMODE
    {
        private const int CCHDEVICENAME = 32;
        private const int CCHFORMNAME = 32;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCHDEVICENAME)]
        public string dmDeviceName;
        public short dmSpecVersion;
        public short dmDriverVersion;
        public short dmSize;
        public short dmDriverExtra;
        public int dmFields;

        public short dmOrientation;
        public short dmPaperSize;
        public short dmPaperLength;
        public short dmPaperWidth;
        public short dmScale;
        public short dmCopies;
        public short dmDefaultSource;
        public short dmPrintQuality;
        public short dmColor;
        public short dmDuplex;
        public short dmYResolution;
        public short dmTTOption;
        public short dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCHFORMNAME)]
        public string dmFormName;
        public short dmLogPixels;
        public int dmBitsPerPel;
        public int dmPelsWidth;
        public int dmPelsHeight;
        public int dmNup;
        public int dmDisplayFrequency;
        public int dmICMMethod;
        public int dmICMIntent;
        public int dmMediaType;
        public int dmDitherType;
        public int dmReserved1;
        public int dmReserved2;
        public int dmPanningWidth;
        public int dmPanningHeight;
    }

    #endregion

    #region WinSpool P/Invoke API Signatures

    [DllImport(WinSpool, EntryPoint = "OpenPrinter", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport(WinSpool, EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport(WinSpool, EntryPoint = "StartDocPrinter", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern uint StartDocPrinter(IntPtr hPrinter, uint level, [In] ref DOCINFO pDocInfo);

    [DllImport(WinSpool, EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport(WinSpool, EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport(WinSpool, EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport(WinSpool, EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, uint dwCount, out uint dwWritten);

    [DllImport(WinSpool, EntryPoint = "DocumentProperties", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int DocumentProperties(
        IntPtr hwnd,
        IntPtr hPrinter,
        string pDeviceName,
        IntPtr pDevModeOutput,
        IntPtr pDevModeInput,
        int fMode);

    [DllImport(WinSpool, EntryPoint = "GetPrinter", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool GetPrinter(
        IntPtr hPrinter,
        uint dwLevel,
        IntPtr pPrinter,
        uint cbBuf,
        out uint pcbNeeded);

    #endregion
}

