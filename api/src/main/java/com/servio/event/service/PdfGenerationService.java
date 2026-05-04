package com.servio.event.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.itextpdf.io.image.ImageDataFactory;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.action.PdfAction;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Image;
import com.itextpdf.layout.element.Link;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.HorizontalAlignment;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.servio.event.entity.EventEntity;
import com.servio.event.entity.LocationEntity;
import com.servio.event.entity.OrderPointEntity;
import com.servio.event.repository.EventRepository;
import com.servio.event.repository.OrderPointRepository;
import com.servio.event.util.OrderPointNameComparator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.Ellipse2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class PdfGenerationService {

    private final EventRepository eventRepository;
    private final OrderPointRepository orderPointRepository;
    private final ImageService imageService;

    @Value("${application.base-url}")
    private String baseUrl;

    private static final Pattern PAY_LATER_GROUP = Pattern.compile("^([A-Za-z]+\\d+)\\.\\d+$");

    public byte[] generateOrderPointsQrPdf(UUID eventId) throws IOException, WriterException {
        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Event not found with id: " + eventId));

        // Match the locations list ordering (alphabetical by location name) and use natural
        // order-point name ordering (so M2 < M10), the same comparator used by EventOrderPointService.
        Comparator<OrderPointEntity> locationThenName = Comparator
                .comparing((OrderPointEntity op) -> op.getLocation().getName(), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(OrderPointNameComparator.by(OrderPointEntity::getName));

        List<OrderPointEntity> orderPoints = orderPointRepository
                .findByLocationIdIncludingSublocations(event.getLocation().getId())
                .stream()
                .sorted(locationThenName)
                .toList();

        List<QrCell> cells = buildQrCells(orderPoints);

        // Load logo image if available
        BufferedImage logoImage = loadEventLogo(event);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdfDocument = new PdfDocument(writer);
        Document document = new Document(pdfDocument);

        // Title: Event Name
        document.add(new Paragraph(event.getName())
                .setFontSize(20)
                .setBold()
                .setTextAlignment(TextAlignment.CENTER));
        document.add(new Paragraph(" "));

        // Create a 3-column table
        Table table = new Table(UnitValue.createPercentArray(new float[]{33.33f, 33.33f, 33.33f}));
        table.setWidth(UnitValue.createPercentValue(100));

        for (QrCell c : cells) {
            String url = baseUrl + "/event/customer/" + eventId + "/order-points/" + c.linkOrderPointId;

            byte[] qrCodeImage = generateQRCodeWithLogo(url, 300, 300, logoImage);
            Image image = new Image(ImageDataFactory.create(qrCodeImage));
            image.setWidth(150);
            image.setHorizontalAlignment(HorizontalAlignment.CENTER);

            String cellLabel = c.locationLabel + " - " + c.label;

            Cell cell = new Cell();
            cell.add(new Paragraph(cellLabel)
                    .setFontSize(10)
                    .setBold()
                    .setTextAlignment(TextAlignment.CENTER));
            cell.add(image);
            // TODO: remove — temporary clickable URL under each QR for testing
            Link link = new Link(url, PdfAction.createURI(url));
            link.setFontColor(ColorConstants.BLUE);
            cell.add(new Paragraph(link)
                    .setFontSize(6)
                    .setTextAlignment(TextAlignment.CENTER));
            cell.setTextAlignment(TextAlignment.CENTER);

            table.addCell(cell);
        }

        // Fill remaining cells if the last row is incomplete
        int remainingCells = cells.size() % 3;
        if (remainingCells != 0) {
            for (int i = 0; i < (3 - remainingCells); i++) {
                table.addCell(new Cell());
            }
        }

        document.add(table);
        document.close();
        return baos.toByteArray();
    }

    private List<QrCell> buildQrCells(List<OrderPointEntity> sortedOrderPoints) {
        List<QrCell> cells = new ArrayList<>(sortedOrderPoints.size());
        Set<String> seenGroups = new HashSet<>();
        for (OrderPointEntity op : sortedOrderPoints) {
            String label = op.getName();
            if (op.isPayLater()) {
                Matcher m = PAY_LATER_GROUP.matcher(op.getName());
                if (m.matches()) {
                    String groupKey = op.getLocation().getId() + "::" + m.group(1);
                    // Sorted input means the lowest-suffix sub-table comes first; emit one
                    // QR for the whole group, pointing to that sub-table's id. The scan flow
                    // already presents a picker via /group when the name matches M{n}.{m}.
                    if (!seenGroups.add(groupKey)) {
                        continue;
                    }
                    label = m.group(1);
                }
            }
            cells.add(new QrCell(op.getId(), label, buildLocationLabel(op.getLocation())));
        }
        return cells;
    }

    private record QrCell(UUID linkOrderPointId, String label, String locationLabel) {}

    private String buildLocationLabel(LocationEntity location) {
        if (location.getParent() != null) {
            // This is a sublocation, show "Parent - Sublocation"
            return location.getParent().getName() + " - " + location.getName();
        }
        return location.getName();
    }

    private BufferedImage loadEventLogo(EventEntity event) {
        if (event.getLogoPath() == null) {
            return null;
        }
        try (InputStream is = imageService.getImage(event.getLogoPath())) {
            return ImageIO.read(is);
        } catch (Exception e) {
            log.warn("Failed to load event logo: {}", e.getMessage());
            return null;
        }
    }

    private byte[] generateQRCodeWithLogo(String text, int width, int height, BufferedImage logo) throws WriterException, IOException {
        // Use high error correction to allow logo overlay
        Map<EncodeHintType, Object> hints = new HashMap<>();
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.H);
        hints.put(EncodeHintType.MARGIN, 1);

        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        BitMatrix bitMatrix = qrCodeWriter.encode(text, BarcodeFormat.QR_CODE, width, height, hints);

        BufferedImage qrImage = MatrixToImageWriter.toBufferedImage(bitMatrix);

        // Overlay logo if available
        if (logo != null) {
            qrImage = overlayLogoOnQRCode(qrImage, logo);
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(qrImage, "PNG", baos);
        return baos.toByteArray();
    }

    private BufferedImage overlayLogoOnQRCode(BufferedImage qrImage, BufferedImage logo) {
        int qrWidth = qrImage.getWidth();
        int qrHeight = qrImage.getHeight();

        // Logo size should be about 20% of QR code size
        int logoSize = (int) (qrWidth * 0.22);

        // Create a new image with the QR code
        BufferedImage combined = new BufferedImage(qrWidth, qrHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = combined.createGraphics();

        // Enable anti-aliasing for smooth edges
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);

        // Draw QR code
        g2d.drawImage(qrImage, 0, 0, null);

        // Calculate logo position (centered)
        int logoX = (qrWidth - logoSize) / 2;
        int logoY = (qrHeight - logoSize) / 2;

        // Draw white circular background for the logo
        int padding = 8;
        g2d.setColor(Color.WHITE);
        g2d.fillOval(logoX - padding, logoY - padding, logoSize + (padding * 2), logoSize + (padding * 2));

        // Create circular clip for logo
        Shape oldClip = g2d.getClip();
        g2d.setClip(new Ellipse2D.Float(logoX, logoY, logoSize, logoSize));

        // Draw scaled logo
        g2d.drawImage(logo, logoX, logoY, logoSize, logoSize, null);

        // Restore clip
        g2d.setClip(oldClip);

        // Draw circular border around logo
        g2d.setColor(new Color(230, 230, 230));
        g2d.setStroke(new BasicStroke(2));
        g2d.drawOval(logoX, logoY, logoSize, logoSize);

        g2d.dispose();
        return combined;
    }
}