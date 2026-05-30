package com.datecs.printerfpgate;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Proprietati de configurare pentru microserviciul printer-app-fpgate.
 * Toate valorile sunt citite din application.properties sub prefixul "printer".
 */
@Component
@ConfigurationProperties(prefix = "printer")
public class PrinterProperties {

    /** Configurare conexiune TCP la casa de marcat */
    private Tcp tcp = new Tcp();

    /** Credentiale operator pentru deschiderea bonului fiscal */
    private Operator operator = new Operator();

    /** Numarul de casa (till number) transmis la deschiderea bonului */
    private String tillNumber = "1";

    /**
     * Seria casei de marcat (afisata in ReceiptResponse.cashRegisterSerial).
     * Daca nu este configurata, se returneaza IP-ul din request.
     */
    private String serialNumber = "";

    /**
     * Cotele TVA configurate pe grupurile fiscale DATECS A/B/C/D.
     * Fiecare grup corespunde unui numar intreg (cota procentuala).
     * Modificati daca imprimanta are programate alte cote.
     */
    private Vat vat = new Vat();

    public Tcp getTcp()                     { return tcp; }
    public void setTcp(Tcp tcp)             { this.tcp = tcp; }

    public Operator getOperator()               { return operator; }
    public void setOperator(Operator operator)  { this.operator = operator; }

    public String getTillNumber()               { return tillNumber; }
    public void setTillNumber(String t)         { this.tillNumber = t; }

    public String getSerialNumber()             { return serialNumber; }
    public void setSerialNumber(String s)       { this.serialNumber = s; }

    public Vat getVat()                         { return vat; }
    public void setVat(Vat v)                   { this.vat = v; }

    public static class Tcp {
        /** IP-ul implicit al casei de marcat (poate fi suprascris din request.cashRegister) */
        private String host = "192.168.100.245";
        /** Portul TCP al DATECS DP-25MX */
        private int    port = 3999;

        public String getHost()       { return host; }
        public void setHost(String h) { this.host = h; }
        public int getPort()          { return port; }
        public void setPort(int p)    { this.port = p; }
    }

    public static class Operator {
        private String code = "1";
        private String pass = "0001";

        public String getCode()       { return code; }
        public void setCode(String c) { this.code = c; }
        public String getPass()       { return pass; }
        public void setPass(String p) { this.pass = p; }
    }

    /**
     * Cotele TVA (%) programate pe fiecare grup fiscal DATECS.
     *
     * Grup 1 = A, Grup 2 = B, Grup 3 = C, Grup 4 = D.
     *
     * Configurare in application.properties:
     *   printer.vat.group-a=21
     *   printer.vat.group-b=11
     *   printer.vat.group-c=9
     *   printer.vat.group-d=0
     *
     * La rezolvarea grupului, se cauta cota primita din request in aceasta
     * configuratie si se returneaza numarul grupului corespunzator (1-4).
     * Daca cota nu se gaseste, se foloseste implicit grupul 1 (A).
     */
    public static class Vat {
        /** Cota TVA (%) pentru grupul fiscal A (DATECS grup 1). Default: 21 */
        private int groupA = 21;
        /** Cota TVA (%) pentru grupul fiscal B (DATECS grup 2). Default: 11 */
        private int groupB = 11;
        /** Cota TVA (%) pentru grupul fiscal C (DATECS grup 3). Default: 9 */
        private int groupC = 9;
        /** Cota TVA (%) pentru grupul fiscal D (DATECS grup 4). Default: 0 */
        private int groupD = 0;

        public int getGroupA()        { return groupA; }
        public void setGroupA(int v)  { this.groupA = v; }
        public int getGroupB()        { return groupB; }
        public void setGroupB(int v)  { this.groupB = v; }
        public int getGroupC()        { return groupC; }
        public void setGroupC(int v)  { this.groupC = v; }
        public int getGroupD()        { return groupD; }
        public void setGroupD(int v)  { this.groupD = v; }
    }
}
