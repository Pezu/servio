package com.servio.event.util;

import java.util.Comparator;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class OrderPointNameComparator {

    private static final Pattern PATTERN = Pattern.compile("^([A-Za-z]+)(\\d+)?(?:\\.(\\d+))?$");

    private OrderPointNameComparator() {}

    public static int compare(String a, String b) {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;

        Matcher ma = PATTERN.matcher(a);
        Matcher mb = PATTERN.matcher(b);
        boolean sa = ma.matches();
        boolean sb = mb.matches();
        if (sa && !sb) return -1;
        if (!sa && sb) return 1;
        if (!sa) return a.compareToIgnoreCase(b);

        int c = ma.group(1).compareToIgnoreCase(mb.group(1));
        if (c != 0) return c;

        int n1a = ma.group(2) != null ? Integer.parseInt(ma.group(2)) : -1;
        int n1b = mb.group(2) != null ? Integer.parseInt(mb.group(2)) : -1;
        if (n1a != n1b) return Integer.compare(n1a, n1b);

        int n2a = ma.group(3) != null ? Integer.parseInt(ma.group(3)) : -1;
        int n2b = mb.group(3) != null ? Integer.parseInt(mb.group(3)) : -1;
        return Integer.compare(n2a, n2b);
    }

    public static <T> Comparator<T> by(Function<T, String> nameExtractor) {
        return (x, y) -> compare(nameExtractor.apply(x), nameExtractor.apply(y));
    }
}
